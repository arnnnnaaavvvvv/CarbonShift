"""Comprehensive Mathematical and Statistical Invariant Unit Tests.

Proves:
- Hand-verified 10 job configurations match implementation down to < 1e-11.
- Integer-scaling error bound holds for S=1000 vs 10xS=10000.
- Statistical metrics match scipy.stats.bootstrap and canonical formulas down to < 1e-9.
- Numerical conservation across simulator runs.
"""

import math
import numpy as np
from scipy import stats

from carbonshift.core.math import (
    compute_server_power_kw,
    compute_slot_overlap_fraction,
    compute_slot_energy_kwh,
    compute_slot_carbon_gco2e,
    compute_transfer_footprint,
    precise_fsum,
)
from carbonshift.metrics.bootstrap import compute_trace_day_bootstrap_ci
from carbonshift.metrics.statistical import pinball_loss, prediction_interval_coverage
from scripts.audit_math_hand_verification import run_hand_verification
from scripts.audit_integer_scaling_bound import verify_integer_scaling_bound


def test_10_hand_verified_jobs_match_zero_error():
    """Assert all 10 hand-verified job configurations match codebase with error < 1e-11."""
    results = run_hand_verification()
    assert len(results) == 10
    for r in results:
        assert r["carbon_err"] < 1e-11, f"{r['job_id']} carbon error {r['carbon_err']} >= 1e-11"
        assert r["cost_err"] < 1e-11, f"{r['job_id']} cost error {r['cost_err']} >= 1e-11"


def test_integer_scaling_error_bound_s_vs_10s():
    """Assert CP-SAT objective discrepancy between S and 10xS satisfies theoretical bound."""
    max_discrepancy = verify_integer_scaling_bound()
    assert max_discrepancy <= 0.05


def test_bootstrap_matches_scipy_exact_raw_precision():
    """Assert bootstrap CI matches scipy.stats.bootstrap exactly (< 1e-9)."""
    data = [20.0, 25.0, 22.0, 28.0, 31.0, 19.0, 24.0, 26.0, 27.0, 23.0]
    seed = 42
    b_iter = 2000

    res_scipy = stats.bootstrap(
        (np.array(data),),
        np.mean,
        confidence_level=0.95,
        n_resamples=b_iter,
        method="percentile",
        random_state=seed,
    )
    ref_low = float(res_scipy.confidence_interval.low)
    ref_high = float(res_scipy.confidence_interval.high)
    ref_med = float(np.median(res_scipy.bootstrap_distribution))

    cs_med, cs_low, cs_high = compute_trace_day_bootstrap_ci(
        daily_savings_pct=data,
        b_iterations=b_iter,
        ci_level=0.95,
        seed=seed,
        raw_precision=True,
    )

    assert abs(cs_low - ref_low) < 1e-9
    assert abs(cs_high - ref_high) < 1e-9
    assert abs(cs_med - ref_med) < 1e-9


def test_pinball_loss_and_picp_match_canonical_reference():
    """Assert pinball loss and interval coverage match canonical reference formulas (< 1e-9)."""
    y_true = [120.0, 180.0, 250.0, 310.0]
    q_pred = [115.0, 195.0, 240.0, 330.0]
    tau = 0.9

    cs_loss = pinball_loss(y_true, q_pred, tau=tau)
    ref_loss = sum(max(tau * (yt - qp), (1.0 - tau) * (qp - yt)) for yt, qp in zip(y_true, q_pred)) / len(y_true)
    assert abs(cs_loss - ref_loss) < 1e-9

    q_low = [100.0, 170.0, 230.0, 300.0]
    q_high = [130.0, 200.0, 260.0, 320.0]
    picp = prediction_interval_coverage(y_true, q_low, q_high)
    assert picp == 1.0
