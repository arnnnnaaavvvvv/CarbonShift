"""Baseline E: Theoretical Oracle (Perfect Foresight).

Upper performance bound. Solves CP-SAT optimization with perfect ex-post
knowledge of realized grid intensities and zero safety buffer.

@see docs/BLUEPRINT.md §8.1
"""

from typing import Dict, List
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.optimizer.cpsat_solver import CPSatScheduler


def schedule_perfect_oracle(
    jobs: List[Job],
    regions: List[Region],
    slots: List[Slot],
    carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
    power_model: ServerPowerModel,
    alpha_carbon: float = 1.0,
    beta_cost: float = 0.1,
) -> Schedule:
    """Solve global CP-SAT schedule with perfect realized grid foresight."""
    scheduler = CPSatScheduler(power_model=power_model)
    sched = scheduler.solve(
        jobs=jobs,
        regions=regions,
        slots=slots,
        carbon_telemetry=carbon_telemetry,
        alpha_carbon=alpha_carbon,
        beta_cost=beta_cost,
        gamma_risk=0.0,
        safety_margin_slots=0,  # Oracle needs no margin
        intensity_quantile="realized_intensity",
    )
    # Return schedule with Oracle naming
    return Schedule(
        id=sched.id,
        strategy_name="Baseline E: Oracle (Perfect Foresight)",
        decisions=sched.decisions,
        total_carbon_gco2e=sched.total_carbon_gco2e,
        total_cost_usd=sched.total_cost_usd,
        deadline_misses=sched.deadline_misses,
        deadline_miss_rate=sched.deadline_miss_rate,
        solver_status=sched.solver_status,
        solve_time_ms=sched.solve_time_ms,
        optimality_gap=sched.optimality_gap,
    )
