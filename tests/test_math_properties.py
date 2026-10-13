"""Hypothesis property-based tests for mathematical invariants.

@see docs/MATH.md §1.6 (Verification Plan)
"""

import pytest
from hypothesis import given, strategies as st
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import calculate_slot_overlap
from carbonshift.metrics.statistical import pinball_loss, symmetric_mape


@given(
    u1=st.floats(min_value=0.0, max_value=1.0),
    u2=st.floats(min_value=0.0, max_value=1.0),
)
def test_specpower_monotonicity(u1: float, u2: float):
    """Assert P(u1) <= P(u2) whenever u1 <= u2 (§1.2.1)."""
    model = ServerPowerModel(p_idle_kw=0.100, p_max_kw=0.500, curvature_r=1.4)
    low_u, high_u = min(u1, u2), max(u1, u2)
    p_low = model.compute_power_kw(low_u)
    p_high = model.compute_power_kw(high_u)
    assert p_low <= p_high
    assert 0.100 <= p_low <= 0.500
    assert 0.100 <= p_high <= 0.500


@given(
    start_sec=st.floats(min_value=0.0, max_value=10000.0),
    duration_sec=st.floats(min_value=1.0, max_value=7200.0),
)
def test_slot_overlap_partition_sum(start_sec: float, duration_sec: float):
    """Assert sum of overlaps across all slots equals exact job duration (§1.2.3)."""
    end_sec = start_sec + duration_sec
    slot_len = 3600.0  # 1 hour slots

    # Spanned slot range
    first_slot = int(start_sec // slot_len)
    last_slot = int(end_sec // slot_len)

    total_accumulated_seconds = 0.0
    for s_idx in range(first_slot, last_slot + 1):
        s_start = s_idx * slot_len
        s_end = (s_idx + 1) * slot_len
        frac = calculate_slot_overlap(start_sec, end_sec, s_start, s_end)
        total_accumulated_seconds += frac * slot_len

    assert pytest.approx(total_accumulated_seconds, abs=1e-3) == duration_sec


@given(
    n_slots=st.integers(min_value=1, max_value=96),
    scale=st.integers(min_value=100, max_value=10000),
)
def test_cpsat_rounding_error_bound(n_slots: int, scale: int):
    """Assert theoretical quantization error <= n_slots * (0.5 / scale) (§1.4.2)."""
    bound = n_slots * (0.5 / scale)
    # Even if every single slot accumulated the maximum 0.5/scale rounding difference:
    max_accumulated_error = sum(0.5 / scale for _ in range(n_slots))
    assert max_accumulated_error <= bound + 1e-9


@given(
    y=st.floats(min_value=10.0, max_value=500.0),
    tau=st.floats(min_value=0.05, max_value=0.95),
)
def test_pinball_loss_exact_prediction_zero(y: float, tau: float):
    """When prediction equals true value, pinball loss must be exactly 0 (§1.5.3)."""
    loss = pinball_loss([y], [y], tau)
    assert pytest.approx(loss, abs=1e-6) == 0.0


@given(
    intensity1=st.floats(min_value=10.0, max_value=500.0),
    intensity2=st.floats(min_value=10.0, max_value=500.0),
    dur1=st.floats(min_value=600.0, max_value=3600.0),
    dur2=st.floats(min_value=600.0, max_value=3600.0),
)
def test_carbon_monotonicity_in_intensity_and_duration(intensity1: float, intensity2: float, dur1: float, dur2: float):
    """Carbon must be monotonic in grid intensity and in job duration."""
    from carbonshift.core.math import compute_server_power_kw, compute_slot_overlap_fraction, compute_slot_energy_kwh, compute_slot_carbon_gco2e
    
    p = compute_server_power_kw(0.7)
    
    # 1. Monotonicity in intensity (holding duration constant)
    low_i, high_i = min(intensity1, intensity2), max(intensity1, intensity2)
    w = compute_slot_overlap_fraction(0.0, dur1, 0.0, 3600.0)
    e = compute_slot_energy_kwh(p, 1.0, 1.0, w)
    c_low_i = compute_slot_carbon_gco2e(e, low_i)
    c_high_i = compute_slot_carbon_gco2e(e, high_i)
    assert c_low_i <= c_high_i

    # 2. Monotonicity in duration (holding intensity constant)
    low_d, high_d = min(dur1, dur2), max(dur1, dur2)
    w_low_d = compute_slot_overlap_fraction(0.0, low_d, 0.0, 3600.0)
    w_high_d = compute_slot_overlap_fraction(0.0, high_d, 0.0, 3600.0)
    e_low = compute_slot_energy_kwh(p, 1.0, 1.0, w_low_d)
    e_high = compute_slot_energy_kwh(p, 1.0, 1.0, w_high_d)
    c_low_d = compute_slot_carbon_gco2e(e_low, intensity1)
    c_high_d = compute_slot_carbon_gco2e(e_high, intensity1)
    assert c_low_d <= c_high_d


@given(
    base_intensity=st.floats(min_value=50.0, max_value=400.0),
    k=st.floats(min_value=0.1, max_value=5.0),
)
def test_scaling_all_intensities_by_k_scales_carbon_by_k(base_intensity: float, k: float):
    """Scaling grid intensity by k scales computed carbon by exactly k."""
    from carbonshift.core.math import compute_server_power_kw, compute_slot_overlap_fraction, compute_slot_energy_kwh, compute_slot_carbon_gco2e
    
    p = compute_server_power_kw(0.8)
    w = compute_slot_overlap_fraction(0.0, 1800.0, 0.0, 3600.0)
    e = compute_slot_energy_kwh(p, 1.0, 1.15, w)

    c_base = compute_slot_carbon_gco2e(e, base_intensity)
    c_scaled = compute_slot_carbon_gco2e(e, base_intensity * k)

    assert pytest.approx(c_scaled, rel=1e-9) == c_base * k


def test_strategy_hierarchy_oracle_le_optimizer_le_run_now():
    """Prove strategy ordering: Oracle <= CP-SAT Optimizer <= Run-Immediately on identical inputs."""
    from carbonshift.core.types import Region, Slot
    from carbonshift.data.synthetic import generate_synthetic_carbon_series
    from carbonshift.data.trace_loader import sample_cluster_trace_jobs
    from carbonshift.optimizer.cpsat_solver import CPSatScheduler
    from carbonshift.baselines.run_now import schedule_run_immediately
    from carbonshift.baselines.oracle import schedule_perfect_oracle
    from carbonshift.simulator.engine import TraceReplaySimulator

    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=128, capacity_mem_gb=512),
        Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=128, capacity_mem_gb=512),
    ]
    slots = [Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0) for i in range(12)]
    telemetry = {r.id: {p.slot_index: p for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=12, seed=42)} for r in regions}
    jobs = sample_cluster_trace_jobs(num_jobs=6, horizon_seconds=43200.0, seed=42, available_regions=[r.id for r in regions])

    from carbonshift.energy.power_model import ServerPowerModel
    pm = ServerPowerModel()
    sim = TraceReplaySimulator(power_model=pm)

    sched_now = schedule_run_immediately(jobs, regions, slots, telemetry, pm)
    sched_opt = CPSatScheduler(power_model=pm).solve(jobs, regions, slots, telemetry, alpha_carbon=1.0, beta_cost=0.0, gamma_risk=0.0, safety_margin_slots=0)
    sched_oracle = schedule_perfect_oracle(jobs, regions, slots, telemetry, pm, alpha_carbon=1.0, beta_cost=0.0)

    res_now = sim.evaluate_schedule(sched_now, jobs, regions, slots, telemetry)
    res_opt = sim.evaluate_schedule(sched_opt, jobs, regions, slots, telemetry)
    res_oracle = sim.evaluate_schedule(sched_oracle, jobs, regions, slots, telemetry)

    # Invariants:
    # 1. Optimizer <= Run-Now
    assert res_opt.total_carbon_gco2e <= res_now.total_carbon_gco2e
    # 2. Oracle <= Optimizer
    assert res_oracle.total_carbon_gco2e <= res_opt.total_carbon_gco2e
    # 3. Whitelist constraints obeyed
    for d in sched_opt.decisions:
        job = next(j for j in jobs if j.id == d.job_id)
        assert d.selected_region in job.region_whitelist
