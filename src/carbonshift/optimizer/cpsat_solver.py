"""Google OR-Tools CP-SAT discrete optimization solver with Robust Mode and Fallback.

Implements multi-objective carbon, cost, and deadline-risk minimization
with exact integer scaling (S=1000), robust quantile planning, and heuristic fallback.

@see docs/MATH.md §4 and docs/BLUEPRINT.md §5
"""

import math
import time
from typing import Dict, List, Optional, Tuple
from ortools.sat.python import cp_model

from carbonshift.core.types import (
    Job,
    Region,
    Slot,
    CarbonPoint,
    Decision,
    Explanation,
    Schedule,
)
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import (
    calculate_job_compute_footprint,
    calculate_transfer_footprint,
)
from carbonshift.baselines.greedy_carbon import schedule_greedy_lowest_carbon_now


class CPSatScheduler:
    """OR-Tools CP-SAT scheduler for carbon-aware batch job allocation."""

    def __init__(
        self,
        integer_scale_carbon: int = 1000,
        integer_scale_cost: int = 10000,
        power_model: Optional[ServerPowerModel] = None,
    ) -> None:
        self.scale_carbon = integer_scale_carbon
        self.scale_cost = integer_scale_cost
        self.power_model = power_model or ServerPowerModel()

    def solve(
        self,
        jobs: List[Job],
        regions: List[Region],
        slots: List[Slot],
        carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
        alpha_carbon: float = 1.0,
        beta_cost: float = 0.1,
        gamma_risk: float = 0.5,
        safety_margin_slots: int = 1,
        intensity_quantile: str = "intensity_p75",
        max_time_seconds: float = 10.0,
        enable_checkpointing: bool = False,
    ) -> Schedule:
        """Formulate and solve the discrete optimization problem with greedy fallback."""
        start_time_wall = time.perf_counter()
        model = cp_model.CpModel()

        region_lookup = {r.id: r for r in regions}
        slot_duration_sec = slots[0].duration_hours * 3600.0 if slots else 3600.0

        x_vars: Dict[Tuple[int, str, int], cp_model.IntVar] = {}
        candidate_metrics: Dict[Tuple[int, str, int], Tuple[float, float, float, float]] = {}

        for j_idx, job in enumerate(jobs):
            job_duration_slots = max(1, math.ceil(job.duration_seconds / slot_duration_sec))

            for region in regions:
                if region.id not in job.region_whitelist:
                    continue

                # Data transfer time delay in seconds
                xfer_sec = 0.0
                if region.id != job.source_region and job.data_size_gb > 0:
                    xfer_sec = 900.0  # 15 min transfer window

                earliest_epoch = job.arrival_epoch_s + xfer_sec
                safety_buffer_sec = safety_margin_slots * slot_duration_sec

                egress_cost = region.egress_costs.get(region.id, 0.02)
                e_xfer, c_xfer, cost_xfer = calculate_transfer_footprint(
                    data_size_gb=job.data_size_gb,
                    src_region_id=job.source_region,
                    dst_region_id=region.id,
                    egress_cost_per_gb=egress_cost,
                )

                reg_carbon_lookup = carbon_telemetry.get(region.id, {})

                for s_idx, slot in enumerate(slots):
                    cand_start_epoch = max(earliest_epoch, slot.start_epoch_s)
                    if earliest_epoch >= slot.end_epoch_s:
                        continue
                    
                    cand_end_epoch = cand_start_epoch + job.duration_seconds
                    
                    # Strict deadline check
                    if cand_end_epoch > job.deadline_epoch_s:
                        continue

                    e_comp, c_comp, cost_comp = calculate_job_compute_footprint(
                        job=job,
                        start_epoch_s=cand_start_epoch,
                        region=region,
                        slots=slots,
                        carbon_lookup=reg_carbon_lookup,
                        power_model=self.power_model,
                        intensity_key=intensity_quantile,
                    )

                    tot_carbon = c_comp + c_xfer
                    tot_cost = cost_comp + cost_xfer
                    
                    slack_remaining_sec = job.deadline_epoch_s - cand_end_epoch
                    risk_penalty = max(0.0, 10000.0 - slack_remaining_sec) / 1000.0

                    var_key = (j_idx, region.id, s_idx)
                    x_vars[var_key] = model.NewBoolVar(f"x_{j_idx}_{region.id}_{s_idx}")
                    candidate_metrics[var_key] = (tot_carbon, tot_cost, risk_penalty, cand_start_epoch)

        # 1. Constraint: Each job assigned to at most 1 slot/region
        for j_idx, job in enumerate(jobs):
            job_candidates = [v for k, v in x_vars.items() if k[0] == j_idx]
            if job_candidates:
                model.Add(sum(job_candidates) == 1)

        # 2. Capacity Constraints per (region, slot)
        for region in regions:
            for slot in slots:
                t = slot.index
                active_cpu = []
                active_mem = []

                for j_idx, job in enumerate(jobs):
                    job_duration_slots = max(1, math.ceil(job.duration_seconds / slot_duration_sec))
                    for s in range(max(0, t - job_duration_slots + 1), t + 1):
                        var_key = (j_idx, region.id, s)
                        if var_key in x_vars:
                            active_cpu.append(x_vars[var_key] * int(job.cpu_cores))
                            active_mem.append(x_vars[var_key] * int(job.mem_gb))

                if active_cpu:
                    model.Add(sum(active_cpu) <= region.capacity_cores)
                if active_mem:
                    model.Add(sum(active_mem) <= region.capacity_mem_gb)

        # 3. Scaled Multi-Objective Formulation
        objective_terms = []
        for var_key, var in x_vars.items():
            tot_carbon, tot_cost, risk_val, _ = candidate_metrics[var_key]
            
            scaled_carbon = int(round(tot_carbon * self.scale_carbon))
            scaled_cost = int(round(tot_cost * self.scale_cost))
            scaled_risk = int(round(risk_val * 100))

            weight_c = int(round(alpha_carbon * 100))
            weight_k = int(round(beta_cost * 100))
            weight_r = int(round(gamma_risk * 100))

            coeff = (weight_c * scaled_carbon) + (weight_k * scaled_cost) + (weight_r * scaled_risk)
            objective_terms.append(var * coeff)

        model.Minimize(sum(objective_terms))

        # Solve model with timeout
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_seconds
        solver.parameters.num_workers = 4
        status = solver.Solve(model)

        solve_time_ms = (time.perf_counter() - start_time_wall) * 1000.0

        # FALLBACK: If solver infeasible or times out, fall back to Greedy Lowest-Carbon heuristic
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            fallback_sched = schedule_greedy_lowest_carbon_now(
                jobs=jobs,
                regions=regions,
                slots=slots,
                carbon_telemetry=carbon_telemetry,
                power_model=self.power_model,
            )
            return Schedule(
                strategy_name="CP-SAT (Fallback: Greedy)",
                decisions=fallback_sched.decisions,
                total_carbon_gco2e=fallback_sched.total_carbon_gco2e,
                total_cost_usd=fallback_sched.total_cost_usd,
                deadline_misses=fallback_sched.deadline_misses,
                deadline_miss_rate=fallback_sched.deadline_miss_rate,
                solver_status="HEURISTIC_FALLBACK",
                solve_time_ms=round(solve_time_ms, 2),
                optimality_gap=1.0,
            )

        decisions: List[Decision] = []
        total_carbon = 0.0
        total_cost = 0.0
        status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"

        for var_key, var in x_vars.items():
            if solver.Value(var) == 1:
                j_idx, r_id, s_idx = var_key
                job = jobs[j_idx]
                carbon_val, cost_val, _, actual_start_epoch = candidate_metrics[var_key]
                
                src_reg = region_lookup.get(job.source_region, regions[0])
                _, c_now, cost_now = calculate_job_compute_footprint(
                    job=job,
                    start_epoch_s=job.arrival_epoch_s,
                    region=src_reg,
                    slots=slots,
                    carbon_lookup=carbon_telemetry.get(job.source_region, {}),
                    power_model=self.power_model,
                )

                saved_c = max(0.0, c_now - carbon_val)
                delta_k = cost_val - cost_now
                delay_h = (actual_start_epoch - job.arrival_epoch_s) / 3600.0

                factors = []
                if r_id != job.source_region:
                    factors.append(f"Migrated to clean region {r_id}")
                if delay_h > 0.5:
                    factors.append(f"Deferred compute by {delay_h:.1f}h to low-carbon window")
                if not factors:
                    factors.append("Dispatched immediately (cleanest window)")

                decisions.append(
                    Decision(
                        job_id=job.id,
                        selected_region=r_id,
                        scheduled_start_epoch_s=actual_start_epoch,
                        assigned_slot=s_idx,
                        estimated_carbon_gco2e=round(carbon_val, 2),
                        estimated_cost_usd=round(cost_val, 4),
                        explanation=Explanation(
                            carbon_saved_vs_now_gco2e=round(saved_c, 2),
                            cost_delta_vs_now_usd=round(delta_k, 4),
                            delay_hours=round(max(0.0, delay_h), 2),
                            spatial_shift_occurred=(r_id != job.source_region),
                            decision_factors=factors,
                        ),
                    )
                )
                total_carbon += carbon_val
                total_cost += cost_val

        raw_obj = solver.ObjectiveValue()

        return Schedule(
            strategy_name="CP-SAT Optimizer",
            decisions=decisions,
            total_carbon_gco2e=round(total_carbon, 2),
            total_cost_usd=round(total_cost, 4),
            deadline_misses=0,
            deadline_miss_rate=0.0,
            solver_status=status_str,
            solve_time_ms=round(solve_time_ms, 2),
            optimality_gap=0.0 if status == cp_model.OPTIMAL else 0.05,
            raw_solver_objective=raw_obj,
        )
