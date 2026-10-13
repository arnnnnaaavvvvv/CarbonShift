"""Regression test pinning benchmark outputs within tight numerical tolerance on a fixed dataset.

Ensures that code modifications do not unintentionally shift benchmark outcomes.
"""

import math
from carbonshift.core.types import Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.ingestion import CarbonDataIngestionEngine
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.baselines.run_now import schedule_run_immediately
from carbonshift.baselines.greedy_carbon import schedule_greedy_lowest_carbon_now
from carbonshift.baselines.oracle import schedule_perfect_oracle
from carbonshift.simulator.engine import TraceReplaySimulator


def test_fixed_dataset_benchmark_regression_pinned_values():
    """Pin solver and simulator results on 20 fixed jobs and 24 fixed slots with seed 1337."""
    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=512, capacity_mem_gb=2048, egress_costs={"uk-north": 0.0, "eu-west": 0.02}),
        Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=512, capacity_mem_gb=2048, egress_costs={"uk-north": 0.02, "eu-west": 0.0}),
    ]
    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(24)
    ]
    power_model = ServerPowerModel()
    simulator = TraceReplaySimulator(power_model=power_model)
    scheduler = CPSatScheduler(power_model=power_model)
    ingestion = CarbonDataIngestionEngine()

    telemetry = {
        r.id: {
            p.slot_index: p
            for p in ingestion.ingest_and_cache(r.id, num_slots=24, seed=1337)
        }
        for r in regions
    }

    jobs = sample_cluster_trace_jobs(
        num_jobs=20,
        horizon_seconds=86400.0,
        seed=1337,
        available_regions=[r.id for r in regions],
    )

    # 1. Run-Now
    s_now = schedule_run_immediately(jobs, regions, slots, telemetry, power_model)
    r_now = simulator.evaluate_schedule(s_now, jobs, regions, slots, telemetry)

    # 2. Greedy-Now
    s_grd = schedule_greedy_lowest_carbon_now(jobs, regions, slots, telemetry, power_model)
    r_grd = simulator.evaluate_schedule(s_grd, jobs, regions, slots, telemetry)

    # 3. CP-SAT Optimizer
    s_opt = scheduler.solve(jobs, regions, slots, telemetry)
    r_opt = simulator.evaluate_schedule(s_opt, jobs, regions, slots, telemetry)

    # 4. Oracle
    s_orc = schedule_perfect_oracle(jobs, regions, slots, telemetry, power_model)
    r_orc = simulator.evaluate_schedule(s_orc, jobs, regions, slots, telemetry)

    # Invariants
    assert r_orc.total_carbon_gco2e <= r_opt.total_carbon_gco2e + 0.05
    assert r_opt.total_carbon_gco2e <= r_now.total_carbon_gco2e

    # Exact pinned regression values (seed 1337)
    assert math.isclose(r_now.total_carbon_gco2e, 2969.08, abs_tol=0.1)
    assert math.isclose(r_opt.total_carbon_gco2e, 2617.71, abs_tol=0.1)
    assert math.isclose(r_orc.total_carbon_gco2e, 2617.71, abs_tol=0.1)

    savings_pct = (r_now.total_carbon_gco2e - r_opt.total_carbon_gco2e) / r_now.total_carbon_gco2e * 100.0
    assert math.isclose(savings_pct, 11.83, abs_tol=0.1)
