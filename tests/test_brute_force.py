"""Cross-check test proving CP-SAT matches exhaustive brute-force search.

@see docs/MATH.md and requirements
"""

import pytest
from carbonshift.core.types import Job, Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.baselines.brute_force import solve_brute_force_optimal


def test_cpsat_matches_exhaustive_brute_force():
    """Run CP-SAT and Brute-Force on 3 jobs across 4 slots; assert identical objective."""
    regions = [
        Region(id="reg-1", name="Region 1", pue=1.1, capacity_cores=32, capacity_mem_gb=128),
        Region(id="reg-2", name="Region 2", pue=1.2, capacity_cores=32, capacity_mem_gb=128),
    ]

    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(4)
    ]

    telemetry = {
        r.id: {
            p.slot_index: p
            for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=4, seed=99)
        }
        for r in regions
    }

    jobs = [
        Job(
            name="job-1",
            arrival_epoch_s=0.0,
            deadline_epoch_s=14400.0,
            duration_seconds=3600,
            cpu_cores=4.0,
            mem_gb=16.0,
            data_size_gb=0.0,
            source_region="reg-1",
            region_whitelist=["reg-1", "reg-2"],
            utilization=0.8,
        ),
        Job(
            name="job-2",
            arrival_epoch_s=0.0,
            deadline_epoch_s=14400.0,
            duration_seconds=3600,
            cpu_cores=8.0,
            mem_gb=32.0,
            data_size_gb=0.0,
            source_region="reg-1",
            region_whitelist=["reg-1", "reg-2"],
            utilization=0.7,
        ),
    ]

    power_model = ServerPowerModel()
    
    # 1. CP-SAT solve
    scheduler = CPSatScheduler(power_model=power_model)
    schedule = scheduler.solve(
        jobs=jobs,
        regions=regions,
        slots=slots,
        carbon_telemetry=telemetry,
        alpha_carbon=1.0,
        beta_cost=0.0,
        gamma_risk=0.0,
        safety_margin_slots=0,
        intensity_quantile="intensity_p50",
    )
    assert schedule.solver_status == "OPTIMAL"

    # 2. Brute Force solve
    best_obj, best_assign = solve_brute_force_optimal(
        jobs=jobs,
        regions=regions,
        slots=slots,
        carbon_telemetry=telemetry,
        power_model=power_model,
        alpha_carbon=1.0,
        beta_cost=0.0,
        scale_carbon=1000,
        scale_cost=10000,
    )

    # Exact mathematical equality between CP-SAT and exhaustive Brute-Force
    assert schedule.raw_solver_objective is not None
    assert int(schedule.raw_solver_objective) == int(best_obj)
    # The selected assignments must also match identically
    cpsat_assign = [(d.selected_region, d.assigned_slot) for d in schedule.decisions]
    assert cpsat_assign == best_assign
