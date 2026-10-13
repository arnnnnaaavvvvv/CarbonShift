"""Statistical Metric and Reference Implementation Verification Suite.

Asserts discrepancies are strictly below 1e-9:
1. Bootstrap CI vs. scipy.stats.bootstrap
2. Pinball Loss vs. canonical definition
3. Prediction Interval Coverage (PICP) vs. canonical definition
4. Float accumulation drift on 100,000 numbers (math.fsum vs naive sum)
"""

import math
import numpy as np
from scipy import stats

from carbonshift.metrics.bootstrap import compute_trace_day_bootstrap_ci
from carbonshift.metrics.statistical import (
    pinball_loss,
    prediction_interval_coverage,
    symmetric_mape,
    mean_absolute_error,
)
from carbonshift.core.math import precise_fsum, kahan_sum


def run_statistical_verification():
    print("=" * 100)
    print("STATISTICAL VERIFICATION AUDIT (TOLERANCE < 1e-9)")
    print("=" * 100)

    # 1. Bootstrap CI vs scipy.stats.bootstrap
    data = [22.4, 25.1, 28.0, 19.5, 24.0, 26.8, 23.9, 27.2, 21.0, 25.5, 29.1, 22.0, 26.3, 24.8]
    seed = 42
    b_iter = 5000

    # Reference scipy
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

    # CarbonShift bootstrap with raw_precision=True
    cs_med, cs_low, cs_high = compute_trace_day_bootstrap_ci(
        daily_savings_pct=data,
        b_iterations=b_iter,
        ci_level=0.95,
        seed=seed,
        raw_precision=True,
    )

    err_low = abs(cs_low - ref_low)
    err_high = abs(cs_high - ref_high)
    err_med = abs(cs_med - ref_med)

    print("\n1. Bootstrap 95% Confidence Interval Verification:")
    print(f"   scipy.stats.bootstrap:  low={ref_low:.12f}, high={ref_high:.12f}, med={ref_med:.12f}")
    print(f"   CarbonShift bootstrap:  low={cs_low:.12f}, high={cs_high:.12f}, med={cs_med:.12f}")
    print(f"   Differences:            low_err={err_low:.2e}, high_err={err_high:.2e}, med_err={err_med:.2e}")
    assert err_low < 1e-9, f"Bootstrap low error {err_low} >= 1e-9"
    assert err_high < 1e-9, f"Bootstrap high error {err_high} >= 1e-9"
    assert err_med < 1e-9, f"Bootstrap med error {err_med} >= 1e-9"
    print("   Status: [PASS < 1e-9]")

    # 2. Pinball loss verification across multiple quantiles
    np.random.seed(123)
    y_true = np.random.uniform(50.0, 400.0, size=5000).tolist()
    q_pred = np.random.uniform(40.0, 420.0, size=5000).tolist()

    print("\n2. Pinball Loss Verification Across Quantiles tau in (0, 1):")
    for tau in [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95]:
        cs_loss = pinball_loss(y_true, q_pred, tau=tau)
        # Reference calculation
        ref_loss = sum(
            max(tau * (yt - qp), (1.0 - tau) * (qp - yt))
            for yt, qp in zip(y_true, q_pred)
        ) / len(y_true)
        p_err = abs(cs_loss - ref_loss)
        print(f"   tau={tau:0.2f}: CS={cs_loss:.10f}, Ref={ref_loss:.10f}, Err={p_err:.2e} [PASS]")
        assert p_err < 1e-9, f"Pinball loss error {p_err} >= 1e-9 for tau={tau}"

    # 3. Prediction Interval Coverage (PICP)
    q_lower = [min(yt - 20.0, qp) for yt, qp in zip(y_true, q_pred)]
    q_upper = [max(yt + 20.0, qp) for yt, qp in zip(y_true, q_pred)]

    cs_picp = prediction_interval_coverage(y_true, q_lower, q_upper)
    ref_picp = sum(1.0 for yt, ql, qu in zip(y_true, q_lower, q_upper) if ql <= yt <= qu) / len(y_true)
    picp_err = abs(cs_picp - ref_picp)
    print(f"\n3. Prediction Interval Coverage (PICP):")
    print(f"   CS={cs_picp:.10f}, Ref={ref_picp:.10f}, Err={picp_err:.2e} [PASS]")
    assert picp_err < 1e-9, f"PICP error {picp_err} >= 1e-9"

    # 4. Floating Point Accumulation Drift on 100,000 Numbers
    print("\n4. Floating Point Accumulation Drift on 100,000 Items:")
    # Create 100,000 numbers with small perturbations where naive sum drifts
    base_val = 1e-7
    large_val = 1e6
    drift_array = [large_val] + [base_val] * 100000 + [-large_val]
    # Mathematically, sum should be 100,000 * 1e-7 = 0.010000000000000000
    expected_sum = 0.010000000000000000

    naive_sum = sum(drift_array)
    fsum_result = precise_fsum(drift_array)
    kahan_result = kahan_sum(drift_array)

    naive_err = abs(naive_sum - expected_sum)
    fsum_err = abs(fsum_result - expected_sum)
    kahan_err = abs(kahan_result - expected_sum)

    print(f"   Expected Sum:    {expected_sum:.17f}")
    print(f"   Naive sum():     {naive_sum:.17f} (drift = {naive_err:.2e})")
    print(f"   precise_fsum():  {fsum_result:.17f} (drift = {fsum_err:.2e})")
    print(f"   kahan_sum():     {kahan_result:.17f} (drift = {kahan_err:.2e})")
    assert fsum_err < 1e-15, f"math.fsum drift {fsum_err} >= 1e-15"
    print("   Status: [PASS < 1e-15]")

    print("\n" + "=" * 100)
    print("ALL STATISTICAL VERIFICATIONS PASSED WITH ZERO DISCREPANCY (< 1e-9)")
    print("=" * 100)


if __name__ == "__main__":
    run_statistical_verification()
