"""Discrete trace-replay simulation engine.

Simulates the realized execution of a Schedule against ground-truth realized telemetry.
Audits deadline compliance and calculates actual realized carbon and cost.

@see docs/BLUEPRINT.md §8.2
"""

from typing import Dict, List
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint


class TraceReplaySimulator:
    """Discrete trace replay simulator for realized schedule evaluation."""

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
        """Simulate and recalculate the realized schedule metrics."""
        job_lookup = {j.id: j for j in jobs}
        region_lookup = {r.id: r for r in regions}

        total_realized_carbon = 0.0
        total_realized_cost = 0.0
        deadline_misses = 0

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

            total_realized_carbon += (c_comp + c_xfer)
            total_realized_cost += (cost_comp + cost_xfer)

            # Check deadline compliance
            completion_epoch_s = decision.scheduled_start_epoch_s + job.duration_seconds
            if completion_epoch_s > job.deadline_epoch_s:
                deadline_misses += 1

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
