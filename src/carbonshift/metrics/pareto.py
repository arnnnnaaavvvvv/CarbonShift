"""Pareto frontier non-dominated sorting for multi-objective optimization.

Evaluates trade-offs between Carbon (gCO2e), Financial Cost (USD), and Deadline Misses.

@see docs/BLUEPRINT.md §8.2
"""

from typing import List, Tuple
from carbonshift.core.types import Schedule


def identify_pareto_frontier(
    schedules: List[Schedule],
) -> List[Schedule]:
    """Filter schedules to return only non-dominated Pareto-optimal solutions.

    A schedule A dominates B if:
    - A is <= B on all objectives (carbon, cost, deadline misses)
    - A is strictly < B on at least one objective
    """
    frontier: List[Schedule] = []

    for cand in schedules:
        is_dominated = False
        c_cand = cand.total_carbon_gco2e
        k_cand = cand.total_cost_usd
        m_cand = cand.deadline_misses

        for other in schedules:
            if other.id == cand.id:
                continue

            c_oth = other.total_carbon_gco2e
            k_oth = other.total_cost_usd
            m_oth = other.deadline_misses

            # Check if other dominates cand
            if (c_oth <= c_cand and k_oth <= k_cand and m_oth <= m_cand) and (
                c_oth < c_cand or k_oth < k_cand or m_oth < m_cand
            ):
                is_dominated = True
                break

        if not is_dominated:
            frontier.append(cand)

    return frontier
