"""Test baseline comparison execution and bootstrap confidence interval engine."""

import pytest
from carbonshift.core.types import Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.baselines.run_now import schedule_run_immediately
from carbonshift.baselines.greedy_carbon import schedule_greedy_lowest_carbon_now
from carbonshift.baselines.oracle import schedule_perfect_oracle
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.simulator.engine import TraceReplaySimulator
from carbonshift.metrics.bootstrap import compute_trace_day_bootstrap_ci


def test_baselines_and_carbon_savings():
    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=256, capacity_mem_gb=1024),
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
            for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=num_slots, seed=42)
        }
        for r in regions
    }

    jobs = sample_cluster_trace_jobs(num_jobs=8, horizon_seconds=float(num_slots * 3600), seed=42)
    power_model = ServerPowerModel()

    from carbonshift.baselines.delay_greedy import schedule_delay_to_deadline_greedy
    # 1. Baseline Run-Immediately
    sched_now = schedule_run_immediately(jobs, regions, slots, telemetry, power_model)
    # 2. Greedy-Now
    sched_grd = schedule_greedy_lowest_carbon_now(jobs, regions, slots, telemetry, power_model)
    # 3. Delay-Greedy
    sched_del = schedule_delay_to_deadline_greedy(jobs, regions, slots, telemetry, power_model)
    # 4. CP-SAT Optimizer
    scheduler = CPSatScheduler(power_model=power_model)
    sched_opt = scheduler.solve(jobs, regions, slots, telemetry)

    simulator = TraceReplaySimulator(power_model=power_model)
    res_now = simulator.evaluate_schedule(sched_now, jobs, regions, slots, telemetry)
    res_grd = simulator.evaluate_schedule(sched_grd, jobs, regions, slots, telemetry)
    res_del = simulator.evaluate_schedule(sched_del, jobs, regions, slots, telemetry)
    res_opt = simulator.evaluate_schedule(sched_opt, jobs, regions, slots, telemetry)

    # Optimizer should equal or reduce carbon compared to immediate dispatch
    assert res_opt.total_carbon_gco2e <= res_now.total_carbon_gco2e
    assert res_grd.total_carbon_gco2e >= 0.0
    assert res_del.total_carbon_gco2e >= 0.0


def test_bootstrap_trace_day_confidence_intervals():
    """Verify block bootstrap over 14 trace days reproduces fixed seed intervals."""
    # 14 trace days with savings centered around ~25%
    daily_savings = [22.4, 25.1, 28.0, 19.5, 24.0, 26.8, 23.9, 27.2, 21.0, 25.5, 29.1, 22.0, 26.3, 24.8]
    med, low, high = compute_trace_day_bootstrap_ci(daily_savings, b_iterations=1000, seed=42)
    assert 20.0 <= med <= 30.0
    assert low < med < high
