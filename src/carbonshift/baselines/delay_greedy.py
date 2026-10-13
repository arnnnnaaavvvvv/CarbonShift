"""Baseline C: Delay-to-Deadline-Greedy.

For each job, evaluates all permissible slots in [a_j, d_j - duration] and chooses
the slot that minimizes instantaneous carbon, ignoring cross-job capacity contention.

@see docs/BLUEPRINT.md §8.1
"""

import math
import time
from typing import Dict, List
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Decision, Explanation, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint


def schedule_delay_to_deadline_greedy(
    jobs: List[Job],
    regions: List[Region],
    slots: List[Slot],
    carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
    power_model: ServerPowerModel,
) -> Schedule:
    """Schedule each job at its independently best carbon slot before deadline."""
    start_time = time.perf_counter()
    region_lookup = {r.id: r for r in regions}
    slot_duration_sec = slots[0].duration_hours * 3600.0 if slots else 3600.0

    decisions: List[Decision] = []
    total_carbon = 0.0
    total_cost = 0.0

    for job in jobs:
        arr_slot = max(0, int(job.arrival_epoch_s // slot_duration_sec))
        deadline_slot = int(job.deadline_epoch_s // slot_duration_sec)
        dur_slots = max(1, math.ceil(job.duration_seconds / slot_duration_sec))
        latest_start = deadline_slot - dur_slots

        best_c = float("inf")
        best_cost = 0.0
        best_slot = arr_slot
        best_region_id = job.source_region

        for r_id in job.region_whitelist:
            reg = region_lookup.get(r_id)
            if not reg:
                continue

            # Data transfer delay
            xfer_delay_slots = 1 if (r_id != job.source_region and job.data_size_gb > 0) else 0
            earliest_start = arr_slot + xfer_delay_slots
            if earliest_start > latest_start:
                continue

            _, c_xfer, cost_xfer = calculate_transfer_footprint(
                data_size_gb=job.data_size_gb,
                src_region_id=job.source_region,
                dst_region_id=r_id,
                egress_cost_per_gb=reg.egress_costs.get(r_id, 0.02),
            )

            for s_idx in range(earliest_start, min(len(slots), latest_start + 1)):
                _, c_comp, cost_comp = calculate_job_compute_footprint(
                    job=job,
                    start_epoch_s=slots[s_idx].start_epoch_s,
                    region=reg,
                    slots=slots,
                    carbon_lookup=carbon_telemetry.get(r_id, {}),
                    power_model=power_model,
                )
                cand_c = c_comp + c_xfer
                if cand_c < best_c:
                    best_c = cand_c
                    best_cost = cost_comp + cost_xfer
                    best_slot = s_idx
                    best_region_id = r_id

        delay_h = (slots[best_slot].start_epoch_s - job.arrival_epoch_s) / 3600.0
        decisions.append(
            Decision(
                job_id=job.id,
                selected_region=best_region_id,
                scheduled_start_epoch_s=slots[best_slot].start_epoch_s,
                assigned_slot=best_slot,
                estimated_carbon_gco2e=round(best_c, 2),
                estimated_cost_usd=round(best_cost, 4),
                explanation=Explanation(
                    carbon_saved_vs_now_gco2e=0.0,
                    cost_delta_vs_now_usd=0.0,
                    delay_hours=round(max(0.0, delay_h), 2),
                    spatial_shift_occurred=(best_region_id != job.source_region),
                    decision_factors=[f"Baseline C: Delayed {delay_h:.1f}h to lowest observed slot {best_slot}"],
                ),
            )
        )
        total_carbon += best_c
        total_cost += best_cost

    solve_time_ms = (time.perf_counter() - start_time) * 1000.0

    return Schedule(
        strategy_name="Baseline C: Delay-to-Deadline",
        decisions=decisions,
        total_carbon_gco2e=round(total_carbon, 2),
        total_cost_usd=round(total_cost, 4),
        deadline_misses=0,
        deadline_miss_rate=0.0,
        solver_status="HEURISTIC",
        solve_time_ms=round(solve_time_ms, 2),
        optimality_gap=0.0,
    )
