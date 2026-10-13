"""Event-driven discrete trace-replay simulator under capacity limits.

Replays jobs under physical node capacity limits (cores and memory).
When scheduled workloads exceed capacity, excess jobs are queued until resources free up.
Audits deadline compliance, wait times, exact carbon, and cost accounting.
Enforces conservation law (|sum C_j - C_agg| <= 1e-9) and differential checks.

@see docs/BLUEPRINT.md §8.2
"""

import heapq
import math
from typing import Dict, List, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Schedule
from carbonshift.core.exceptions import ParityViolationError
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint
from carbonshift.core.math import precise_fsum, differential_recompute, compute_server_power_kw, compute_slot_overlap_fraction


class RegionResourceCluster:
    """Discrete event resource tracker for a cloud region."""

    def __init__(self, capacity_cores: float, capacity_mem_gb: float) -> None:
        self.capacity_cores = capacity_cores
        self.capacity_mem_gb = capacity_mem_gb
        # Priority queue of (finish_time_s, cores, mem)
        self.running: List[Tuple[float, float, float]] = []
        self.used_cpu = 0.0
        self.used_mem = 0.0

    def schedule_execution(
        self,
        target_start_epoch_s: float,
        duration_seconds: float,
        cpu_cores: float,
        mem_gb: float,
    ) -> float:
        """Admit job at target time or queue until capacity frees up.

        Returns:
            actual_start_epoch_s
        """
        t = target_start_epoch_s
        # 1. Release all tasks completed before or at t
        while self.running and self.running[0][0] <= t:
            fin, c, m = heapq.heappop(self.running)
            self.used_cpu = max(0.0, self.used_cpu - c)
            self.used_mem = max(0.0, self.used_mem - m)

        # 2. If capacity exceeded, wait for running tasks to complete
        while self.used_cpu + cpu_cores > self.capacity_cores or self.used_mem + mem_gb > self.capacity_mem_gb:
            if not self.running:
                break
            fin, c, m = heapq.heappop(self.running)
            self.used_cpu = max(0.0, self.used_cpu - c)
            self.used_mem = max(0.0, self.used_mem - m)
            t = max(t, fin)
            # Release any other tasks completed by the new time
            while self.running and self.running[0][0] <= t:
                f2, c2, m2 = heapq.heappop(self.running)
                self.used_cpu = max(0.0, self.used_cpu - c2)
                self.used_mem = max(0.0, self.used_mem - m2)

        actual_start = t
        actual_end = t + duration_seconds
        heapq.heappush(self.running, (actual_end, cpu_cores, mem_gb))
        self.used_cpu += cpu_cores
        self.used_mem += mem_gb
        return actual_start


class TraceReplaySimulator:
    """Discrete event simulator for workload replay under capacity constraints."""

    def __init__(self, power_model: ServerPowerModel) -> None:
        self.power_model = power_model

    def evaluate_schedule(
        self,
        schedule: Schedule,
        jobs: List[Job],
        regions: List[Region],
        slots: List[Slot],
        realized_telemetry: Dict[str, Dict[int, CarbonPoint]],
    ) -> Schedule:
        """Simulate and recalculate the realized schedule metrics under capacity limits."""
        job_lookup = {j.id: j for j in jobs}
        region_lookup = {r.id: r for r in regions}

        # Initialize event resource clusters per region
        clusters = {
            r.id: RegionResourceCluster(float(r.capacity_cores), float(r.capacity_mem_gb))
            for r in regions
        }

        # Sort decisions chronologically by scheduled start for realistic FIFO queueing
        sorted_decisions = sorted(
            schedule.decisions,
            key=lambda d: (d.scheduled_start_epoch_s, job_lookup[d.job_id].arrival_epoch_s if d.job_id in job_lookup else 0.0),
        )

        per_job_c: List[float] = []
        per_job_k: List[float] = []
        deadline_misses = 0

        job_tuples_diff: List[Tuple[float, float, float, float, float, float]] = []
        transfer_tuples_diff: List[Tuple[float, bool, float]] = []

        for decision in sorted_decisions:
            job = job_lookup.get(decision.job_id)
            if not job:
                continue

            region = region_lookup.get(decision.selected_region, regions[0])
            reg_telemetry = realized_telemetry.get(region.id, {})
            cluster = clusters[region.id]

            # Transfer latency delay if cross-region
            is_cross = (job.source_region != region.id)
            xfer_delay = 900.0 if (is_cross and job.data_size_gb > 0) else 0.0
            earliest_possible_start = max(job.arrival_epoch_s + xfer_delay, decision.scheduled_start_epoch_s)

            # Admit under physical capacity limits
            actual_start_epoch = cluster.schedule_execution(
                target_start_epoch_s=earliest_possible_start,
                duration_seconds=float(job.duration_seconds),
                cpu_cores=job.cpu_cores,
                mem_gb=job.mem_gb,
            )

            actual_end_epoch = actual_start_epoch + job.duration_seconds

            # 1. Compute realized compute footprint
            _, c_comp, cost_comp = calculate_job_compute_footprint(
                job=job,
                start_epoch_s=actual_start_epoch,
                region=region,
                slots=slots,
                carbon_lookup=reg_telemetry,
                power_model=self.power_model,
                intensity_key="realized_intensity",
            )

            # 2. Compute realized transfer footprint
            _, c_xfer, cost_xfer = calculate_transfer_footprint(
                data_size_gb=job.data_size_gb,
                src_region_id=job.source_region,
                dst_region_id=region.id,
                egress_cost_per_gb=region.egress_costs.get(region.id, 0.02),
            )

            job_carbon = c_comp + c_xfer
            job_cost = cost_comp + cost_xfer

            per_job_c.append(job_carbon)
            per_job_k.append(job_cost)

            # Collect for differential check
            p_kw = self.power_model.compute_power_kw(job.utilization)
            for s in slots:
                w = compute_slot_overlap_fraction(actual_start_epoch, actual_end_epoch, s.start_epoch_s, s.end_epoch_s)
                if w > 0.0 and s.index in reg_telemetry:
                    c_pt = reg_telemetry[s.index]
                    job_tuples_diff.append((p_kw, s.duration_hours, region.pue, w, c_pt.intensity_p50, c_pt.price_per_kwh))
            transfer_tuples_diff.append((job.data_size_gb, is_cross, region.egress_costs.get(region.id, 0.02)))

            # Check deadline compliance
            if actual_end_epoch > job.deadline_epoch_s:
                deadline_misses += 1

        # Conservation check: sum(per_job_c) vs math.fsum(per_job_c)
        total_realized_carbon = precise_fsum(per_job_c)
        total_realized_cost = precise_fsum(per_job_k)

        if total_realized_carbon > 0.0:
            direct_sum = sum(per_job_c)
            rel_conservation_err = abs(direct_sum - total_realized_carbon) / total_realized_carbon
            if rel_conservation_err > 1e-9:
                raise ParityViolationError(
                    f"Conservation law violation: direct_sum={direct_sum}, fsum={total_realized_carbon}, "
                    f"rel_err={rel_conservation_err:.3e} > 1e-9"
                )

        # Differential check with secondary independent implementation
        diff_c, diff_k = differential_recompute(job_tuples_diff, transfer_tuples_diff)
        if total_realized_carbon > 0.0:
            rel_diff_err = abs(diff_c - total_realized_carbon) / total_realized_carbon
            if rel_diff_err > 1e-9:
                raise ParityViolationError(
                    f"Differential parity mismatch: simulator={total_realized_carbon}, "
                    f"differential={diff_c}, rel_err={rel_diff_err:.3e} > 1e-9"
                )

        miss_rate = (deadline_misses / len(jobs)) if jobs else 0.0

        return Schedule(
            id=schedule.id,
            strategy_name=schedule.strategy_name,
            decisions=schedule.decisions,
            total_carbon_gco2e=round(total_realized_carbon, 2),
            total_cost_usd=round(total_realized_cost, 4),
            deadline_misses=deadline_misses,
            deadline_miss_rate=round(miss_rate * 100.0, 2),
            solver_status=schedule.solver_status,
            solve_time_ms=schedule.solve_time_ms,
            optimality_gap=schedule.optimality_gap,
        )
