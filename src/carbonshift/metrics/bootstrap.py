"""Trace-day block bootstrap for robust 95% confidence intervals.

The resampling unit is the full trace day to preserve temporal autocorrelation.
B >= 10,000 iterations with fixed PRNG seed for exact reproducibility.

@see docs/MATH.md §5 and docs/BLUEPRINT.md §8.2
"""

from typing import Sequence, Tuple
import numpy as np


def compute_trace_day_bootstrap_ci(
    daily_savings_pct: Sequence[float],
    b_iterations: int = 10000,
    ci_level: float = 0.95,
    seed: int = 42,
) -> Tuple[float, float, float]:
    """Calculate the bootstrap median and (1 - alpha) confidence interval.

    Args:
        daily_savings_pct: Sequence of daily savings S_d across D trace days.
        b_iterations: Number of bootstrap resamples (default: 10,000).
        ci_level: Confidence level (default: 0.95).
        seed: Random seed for reproducible resampling.

    Returns:
        (median_savings_pct, ci_lower_pct, ci_upper_pct)
    """
    data = np.asarray(daily_savings_pct, dtype=float)
    d_count = len(data)
    if d_count == 0:
        return 0.0, 0.0, 0.0

    rng = np.random.RandomState(seed)

    # Resample D trace days with replacement B times
    # Shape: (b_iterations, d_count)
    resample_indices = rng.randint(0, d_count, size=(b_iterations, d_count))
    resampled_means = np.mean(data[resample_indices], axis=1)

    alpha = 1.0 - ci_level
    lower_pct = 100.0 * (alpha / 2.0)
    upper_pct = 100.0 * (1.0 - alpha / 2.0)

    median_val = float(np.median(resampled_means))
    ci_lower = float(np.percentile(resampled_means, lower_pct))
    ci_upper = float(np.percentile(resampled_means, upper_pct))

    return round(median_val, 2), round(ci_lower, 2), round(ci_upper, 2)
