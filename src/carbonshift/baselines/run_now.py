"""Baseline A: Run-Immediately.

Schedules jobs strictly at their arrival slot in their origin region.
Mirrors unmanaged, vanilla cloud / Kubernetes execution.

@see docs/BLUEPRINT.md §8.1
"""

import time
from typing import Dict, List
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Decision, Explanation, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint


def schedule_run_immediately(
    jobs: List[Job],
    regions: List[Region],
    slots: List[Slot],
    carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
    power_model: ServerPowerModel,
) -> Schedule:
    """Schedule every job at its immediate arrival slot in its origin region."""
    start_time = time.perf_counter()
    region_lookup = {r.id: r for r in regions}
    slot_duration_sec = slots[0].duration_hours * 3600.0 if slots else 3600.0

    decisions: List[Decision] = []
    total_carbon = 0.0
    total_cost = 0.0

    for job in jobs:
        arr_slot = min(len(slots) - 1, max(0, int(job.arrival_epoch_s // slot_duration_sec)))
        region = region_lookup.get(job.source_region, regions[0])
        reg_carbon = carbon_telemetry.get(job.source_region, {})

        _, c_val, cost_val = calculate_job_compute_footprint(
            job=job,
            start_epoch_s=slots[arr_slot].start_epoch_s,
            region=region,
            slots=slots,
            carbon_lookup=reg_carbon,
            power_model=power_model,
        )

        decisions.append(
            Decision(
                job_id=job.id,
                selected_region=region.id,
                scheduled_start_epoch_s=slots[arr_slot].start_epoch_s,
                assigned_slot=arr_slot,
                estimated_carbon_gco2e=round(c_val, 2),
                estimated_cost_usd=round(cost_val, 4),
                explanation=Explanation(
                    carbon_saved_vs_now_gco2e=0.0,
                    cost_delta_vs_now_usd=0.0,
                    delay_hours=0.0,
                    spatial_shift_occurred=False,
                    decision_factors=["Baseline: Dispatched immediately upon arrival in origin region"],
                ),
            )
        )
        total_carbon += c_val
        total_cost += cost_val

    solve_time_ms = (time.perf_counter() - start_time) * 1000.0

    return Schedule(
        strategy_name="Baseline A: Run-Immediately",
        decisions=decisions,
        total_carbon_gco2e=round(total_carbon, 2),
        total_cost_usd=round(total_cost, 4),
        deadline_misses=0,
        deadline_miss_rate=0.0,
        solver_status="HEURISTIC",
        solve_time_ms=round(solve_time_ms, 2),
        optimality_gap=0.0,
    )
