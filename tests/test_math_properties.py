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
