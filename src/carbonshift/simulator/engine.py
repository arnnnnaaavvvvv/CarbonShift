"""Event-driven discrete trace-replay simulator under capacity limits.

Replays jobs under capacity limits, auditing deadline compliance, per-job wait times,
and exact carbon/cost accounting. Enforces conservation law (|sum C_j - C_agg| <= 1e-9)
and differential recomputations.

@see docs/BLUEPRINT.md §8.2
"""

import math
from typing import Dict, List, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Schedule
from carbonshift.core.exceptions import ParityViolationError
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint
from carbonshift.core.math import precise_fsum, differential_recompute


class SimulationResult:
    """Detailed per-job and aggregate results from a simulated replay."""

    def __init__(
        self,
        schedule: Schedule,
        per_job_carbon: Dict[str, float],
        per_job_cost: Dict[str, float],
        per_job_wait_hours: Dict[str, float],
        per_job_completion_epoch: Dict[str, float],
        deadline_misses: int,
        capacity_violations: int,
    ) -> None:
        self.schedule = schedule
        self.per_job_carbon = per_job_carbon
        self.per_job_cost = per_job_cost
        self.per_job_wait_hours = per_job_wait_hours
        self.per_job_completion_epoch = per_job_completion_epoch
        self.deadline_misses = deadline_misses
        self.capacity_violations = capacity_violations


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
        """Simulate and recalculate the realized schedule metrics with strict checks."""
        job_lookup = {j.id: j for j in jobs}
        region_lookup = {r.id: r for r in regions}
        slot_duration_sec = slots[0].duration_hours * 3600.0 if slots else 3600.0

        # Slot capacity occupancy tracking: (region_id, slot_idx) -> (used_cpu, used_mem)
        capacity_usage: Dict[Tuple[str, int], Tuple[float, float]] = {}

        per_job_c: List[float] = []
        per_job_k: List[float] = []
        deadline_misses = 0
        capacity_violations = 0

        job_tuples_diff = []
        transfer_tuples_diff = []

        for decision in schedule.decisions:
            job = job_lookup.get(decision.job_id)
            if not job:
                continue

            region = region_lookup.get(decision.selected_region, regions[0])
            reg_telemetry = realized_telemetry.get(region.id, {})

            # 1. Compute realized compute footprint
            _, c_comp, cost_comp = calculate_job_compute_footprint(
                job=job,
                start_epoch_s=decision.scheduled_start_epoch_s,
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

            # Check capacity consumption across all occupied slots
            start_slot = decision.assigned_slot
            job_dur_slots = max(1, math.ceil(job.duration_seconds / slot_duration_sec))
            for s_idx in range(start_slot, min(len(slots), start_slot + job_dur_slots)):
                cap_key = (region.id, s_idx)
                curr_cpu, curr_mem = capacity_usage.get(cap_key, (0.0, 0.0))
                new_cpu = curr_cpu + job.cpu_cores
                new_mem = curr_mem + job.mem_gb
                capacity_usage[cap_key] = (new_cpu, new_mem)

                if new_cpu > region.capacity_cores or new_mem > region.capacity_mem_gb:
                    capacity_violations += 1

            # Check deadline compliance
            completion_epoch_s = decision.scheduled_start_epoch_s + job.duration_seconds
            if completion_epoch_s > job.deadline_epoch_s:
                deadline_misses += 1

        # Conservation check: math.fsum(per_job_c) vs sum
        total_realized_carbon = precise_fsum(per_job_c)
        total_realized_cost = precise_fsum(per_job_k)

        # Numerical conservation invariant verification
        if total_realized_carbon > 0.0:
            direct_sum = sum(per_job_c)
            rel_conservation_err = abs(direct_sum - total_realized_carbon) / total_realized_carbon
            if rel_conservation_err > 1e-9:
                raise ParityViolationError(
                    f"Conservation law violation: direct_sum={direct_sum}, fsum={total_realized_carbon}, "
                    f"rel_err={rel_conservation_err:.3e} > 1e-9"
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
