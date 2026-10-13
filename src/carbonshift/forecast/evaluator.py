"""Walk-forward cross-validation evaluator for carbon intensity forecasters.

Computes sMAPE, MAE, Pinball loss (P10/P50/P90), and interval coverage probability (PICP).

@see docs/BLUEPRINT.md §8.2
"""

from typing import Dict, List, Type
import numpy as np
import pandas as pd

from carbonshift.forecast.interface import BaseForecaster
from carbonshift.metrics.statistical import (
    symmetric_mape,
    mean_absolute_error,
    pinball_loss,
    prediction_interval_coverage,
)


class WalkForwardForecastEvaluator:
    """Walk-forward time series cross-validator."""

    def __init__(
        self,
        horizon_slots: int = 24,
        step_slots: int = 24,
        min_train_slots: int = 48,
    ) -> None:
        self.horizon_slots = horizon_slots
        self.step_slots = step_slots
        self.min_train_slots = min_train_slots

    def evaluate(
        self,
        forecaster: BaseForecaster,
        full_series: pd.DataFrame,
    ) -> Dict[str, float]:
        """Run walk-forward validation across the series without temporal lookahead."""
        n_total = len(full_series)
        all_true = []
        all_p10 = []
        all_p50 = []
        all_p90 = []

        current_idx = self.min_train_slots

        while current_idx + self.horizon_slots <= n_total:
            train_df = full_series.iloc[:current_idx]
            test_df = full_series.iloc[current_idx : current_idx + self.horizon_slots]

            forecaster.fit(train_df)
            preds = forecaster.predict_quantiles(horizon_slots=self.horizon_slots)

            actual = test_df["intensity"].to_numpy(dtype=float)
            all_true.extend(actual)
            all_p10.extend(preds["p10"])
            all_p50.extend(preds["p50"])
            all_p90.extend(preds["p90"])

            current_idx += self.step_slots

        if not all_true:
            return {}

        y_true = np.array(all_true)
        p10 = np.array(all_p10)
        p50 = np.array(all_p50)
        p90 = np.array(all_p90)

        return {
            "smape_pct": round(symmetric_mape(y_true, p50), 2),
            "mae_gco2e_per_kwh": round(mean_absolute_error(y_true, p50), 2),
            "pinball_loss_p10": round(pinball_loss(y_true, p10, 0.10), 3),
            "pinball_loss_p50": round(pinball_loss(y_true, p50, 0.50), 3),
            "pinball_loss_p90": round(pinball_loss(y_true, p90, 0.90), 3),
            "interval_coverage_pct": round(prediction_interval_coverage(y_true, p10, p90) * 100.0, 2),
        }
