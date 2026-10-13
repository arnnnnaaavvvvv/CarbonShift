"""Trace-day block bootstrap for robust 95% confidence intervals.

The resampling unit is the full trace day to preserve temporal autocorrelation.
B >= 10,000 iterations with fixed PRNG seed for exact reproducibility.
Uses scipy.stats.bootstrap as the verified canonical statistical reference.

@see docs/MATH.md §5 and docs/BLUEPRINT.md §8.2
"""

from typing import Sequence, Tuple
import numpy as np
from scipy import stats


def compute_trace_day_bootstrap_ci(
    daily_savings_pct: Sequence[float],
    b_iterations: int = 10000,
    ci_level: float = 0.95,
    seed: int = 42,
    raw_precision: bool = False,
) -> Tuple[float, float, float]:
    """Calculate the bootstrap median and (1 - alpha) confidence interval.

    Args:
        daily_savings_pct: Sequence of daily savings S_d across D trace days.
        b_iterations: Number of bootstrap resamples (default: 10,000).
        ci_level: Confidence level (default: 0.95).
        seed: Random seed for reproducible resampling.
        raw_precision: If True, return unrounded exact floats for mathematical auditing.

    Returns:
        (median_savings_pct, ci_lower_pct, ci_upper_pct)
    """
    data = np.asarray(daily_savings_pct, dtype=float)
    d_count = len(data)
    if d_count == 0:
        return 0.0, 0.0, 0.0

    res = stats.bootstrap(
        (data,),
        np.mean,
        confidence_level=ci_level,
        n_resamples=b_iterations,
        method="percentile",
        random_state=seed,
    )

    ci_lower = float(res.confidence_interval.low)
    ci_upper = float(res.confidence_interval.high)
    median_val = float(np.median(res.bootstrap_distribution))

    if raw_precision:
        return median_val, ci_lower, ci_upper
    return round(median_val, 2), round(ci_lower, 2), round(ci_upper, 2)
