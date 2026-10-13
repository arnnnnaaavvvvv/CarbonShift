"""Statistical metrics for carbon forecasting and prediction evaluation.

@see docs/MATH.md §5
"""

from typing import List, Sequence
import numpy as np


def symmetric_mape(
    y_true: Sequence[float],
    y_pred: Sequence[float],
    epsilon_floor: float = 1.0,
) -> float:
    """Compute epsilon-stabilized symmetric Mean Absolute Percentage Error (sMAPE).

    @see docs/MATH.md §5
    Formula:
        (100% / N) * sum( |y - y_hat| / ( 0.5 * (|y| + |y_hat|) + eps ) )
    """
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)
    if len(y_t) == 0:
        return 0.0

    numerator = np.abs(y_t - y_p)
    denominator = 0.5 * (np.abs(y_t) + np.abs(y_p)) + epsilon_floor
    return float(np.mean(numerator / denominator) * 100.0)


def mean_absolute_error(
    y_true: Sequence[float],
    y_pred: Sequence[float],
) -> float:
    """Compute Mean Absolute Error (MAE) in gCO2e/kWh."""
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)
    if len(y_t) == 0:
        return 0.0
    return float(np.mean(np.abs(y_t - y_p)))


def pinball_loss(
    y_true: Sequence[float],
    q_pred: Sequence[float],
    tau: float,
) -> float:
    """Compute Pinball (Quantile) loss for quantile tau in (0, 1).

    @see docs/MATH.md §5
    Formula:
        mean( max( tau * (y - q), (1 - tau) * (q - y) ) )
    """
    if not (0.0 < tau < 1.0):
        raise ValueError(f"Quantile tau must be in (0, 1), got {tau}")

    y_t = np.asarray(y_true, dtype=float)
    q_p = np.asarray(q_pred, dtype=float)
    if len(y_t) == 0:
        return 0.0

    diff = y_t - q_p
    loss = np.maximum(tau * diff, (1.0 - tau) * -diff)
    return float(np.mean(loss))


def prediction_interval_coverage(
    y_true: Sequence[float],
    q_lower: Sequence[float],
    q_upper: Sequence[float],
) -> float:
    """Compute Prediction Interval Coverage Probability (PICP).

    @see docs/MATH.md §5
    Returns fraction of true observations falling inside [q_lower, q_upper].
    """
    y_t = np.asarray(y_true, dtype=float)
    ql = np.asarray(q_lower, dtype=float)
    qu = np.asarray(q_upper, dtype=float)
    if len(y_t) == 0:
        return 0.0

    inside = (y_t >= ql) & (y_t <= qu)
    return float(np.mean(inside))
