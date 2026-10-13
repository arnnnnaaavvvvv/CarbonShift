"""Exhaustive brute-force scheduler for tiny instances (<= 6 jobs x 8 slots).

Provides a reference implementation to cross-check CP-SAT optimizer optimality.
The CP-SAT objective must match the brute-force minimum exactly.

@see docs/BLUEPRINT.md §8
"""

import itertools
from typing import Dict, List, Optional, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint


def solve_brute_force_optimal(
    jobs: List[Job],
    regions: List[Region],
    slots: List[Slot],
    carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
    power_model: ServerPowerModel,
    alpha_carbon: float = 1.0,
    beta_cost: float = 0.1,
    scale_carbon: int = 1000,
    scale_cost: int = 10000,
) -> Tuple[float, List[Tuple[str, int]]]:
    """Exhaustively enumerate all valid combinations to find the exact global minimum.

    Returns:
        (min_scaled_objective, best_assignment_list)
    """
    if len(jobs) > 6 or len(slots) > 8:
        raise ValueError(f"Brute-force solver limited to <= 6 jobs and <= 8 slots, got {len(jobs)} jobs, {len(slots)} slots")

    slot_duration_sec = slots[0].duration_hours * 3600.0 if slots else 3600.0
    region_lookup = {r.id: r for r in regions}

    # 1. Generate valid candidate options for each job
    job_candidate_options: List[List[Tuple[str, int, float, float, float]]] = []

    for job in jobs:
        cand_list = []
        for region in regions:
            if region.id not in job.region_whitelist:
                continue

            xfer_sec = 900.0 if (region.id != job.source_region and job.data_size_gb > 0) else 0.0
            earliest_epoch = job.arrival_epoch_s + xfer_sec

            egress_cost = region.egress_costs.get(region.id, 0.02)
            e_xfer, c_xfer, cost_xfer = calculate_transfer_footprint(
                data_size_gb=job.data_size_gb,
                src_region_id=job.source_region,
                dst_region_id=region.id,
                egress_cost_per_gb=egress_cost,
            )

            for s_idx, slot in enumerate(slots):
                cand_start = max(earliest_epoch, slot.start_epoch_s)
                if earliest_epoch >= slot.end_epoch_s:
                    continue
                cand_end = cand_start + job.duration_seconds
                if cand_end > job.deadline_epoch_s:
                    continue

                _, c_comp, cost_comp = calculate_job_compute_footprint(
                    job=job,
                    start_epoch_s=cand_start,
                    region=region,
                    slots=slots,
                    carbon_lookup=carbon_telemetry.get(region.id, {}),
                    power_model=power_model,
                )
                tot_c = c_comp + c_xfer
                tot_k = cost_comp + cost_xfer
                
                slack_rem = job.deadline_epoch_s - cand_end
                risk_val = max(0.0, 10000.0 - slack_rem) / 1000.0

                cand_list.append((region.id, s_idx, tot_c, tot_k, risk_val))
        job_candidate_options.append(cand_list)

    best_objective = float("inf")
    best_assignment: List[Tuple[str, int]] = []

    # 2. Cartesian product across candidate options
    for assignment in itertools.product(*job_candidate_options):
        # Check capacity constraints
        # capacity_usage: (region_id, slot_idx) -> [used_cpu, used_mem]
        capacity_usage: Dict[Tuple[str, int], Tuple[float, float]] = {}
        feasible = True

        for j_idx, (r_id, s_idx, _, _, _) in enumerate(assignment):
            job = jobs[j_idx]
            reg = region_lookup[r_id]
            job_dur_slots = max(1, int(job.duration_seconds // slot_duration_sec))
            for t in range(s_idx, min(len(slots), s_idx + job_dur_slots)):
                k = (r_id, t)
                c_cpu, c_mem = capacity_usage.get(k, (0.0, 0.0))
                n_cpu = c_cpu + job.cpu_cores
                n_mem = c_mem + job.mem_gb
                if n_cpu > reg.capacity_cores or n_mem > reg.capacity_mem_gb:
                    feasible = False
                    break
                capacity_usage[k] = (n_cpu, n_mem)
            if not feasible:
                break

        if not feasible:
            continue

        # Evaluate scaled objective
        obj_val = 0.0
        for _, _, c_val, k_val, r_val in assignment:
            scaled_c = int(round(c_val * scale_carbon))
            scaled_k = int(round(k_val * scale_cost))
            scaled_r = int(round(r_val * 100))
            obj_val += (int(round(alpha_carbon * 100)) * scaled_c) + (int(round(beta_cost * 100)) * scaled_k)

        if obj_val < best_objective:
            best_objective = obj_val
            best_assignment = [(r_id, s_idx) for (r_id, s_idx, _, _, _) in assignment]

    return best_objective, best_assignment
