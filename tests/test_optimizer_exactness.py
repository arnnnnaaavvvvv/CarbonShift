"""Verification tests for CP-SAT solver exactness and independent parity check.

@see docs/MATH.md §1.4.3
"""

import pytest
from carbonshift.core.types import Job, Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.simulator.auditor import ParityAuditor


def test_optimizer_solves_and_verifies_parity():
    """Solve a batch workload and assert solver objective equals simulator float replay."""
    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=128, capacity_mem_gb=512),
        Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=256, capacity_mem_gb=1024),
    ]

    num_slots = 24
    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(num_slots)
    ]

    telemetry = {
        r.id: {
            p.slot_index: p
            for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=num_slots, seed=123)
        }
        for r in regions
    }

    jobs = sample_cluster_trace_jobs(
        num_jobs=10,
        horizon_seconds=float(num_slots * 3600),
        seed=123,
        available_regions=[r.id for r in regions],
    )

    power_model = ServerPowerModel()
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

    assert schedule.solver_status in ("OPTIMAL", "FEASIBLE")
    assert len(schedule.decisions) == len(jobs)

    # Assert Parity with simulator independent recomputation
    auditor = ParityAuditor(tolerance=1e-4)
    is_valid = auditor.verify_parity(
        schedule=schedule,
        jobs=jobs,
        regions=regions,
        slots=slots,
        telemetry=telemetry,
        power_model=power_model,
    )
    assert is_valid is True
