"""LightGBM Quantile Regression Forecaster for Carbon Intensity.

Trains quantile regression trees (alpha = 0.10, 0.50, 0.90) with lag and Fourier features.

@see docs/BLUEPRINT.md §6
"""

import math
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
import lightgbm as lgb
from carbonshift.forecast.interface import BaseForecaster


class LightGBMQuantileForecaster(BaseForecaster):
    """Gradient boosted quantile regressor outputting P10, P50, and P90 paths."""

    def __init__(self, quantiles: Optional[List[float]] = None) -> None:
        self.quantiles = quantiles or [0.10, 0.50, 0.90]
        self.models: Dict[str, lgb.Booster] = {}
        self.last_known_history: np.ndarray = np.array([])

    def _engineer_features(self, series: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Generate lag and cyclical time features.

        Features: [hour_sin, hour_cos, lag_1, lag_2, lag_24, rolling_mean_6]
        """
        n = len(series)
        x_list, y_list = [], []

        for i in range(24, n):
            hour = i % 24
            h_sin = math.sin(2.0 * math.pi * hour / 24.0)
            h_cos = math.cos(2.0 * math.pi * hour / 24.0)
            lag_1 = series[i - 1]
            lag_2 = series[i - 2]
            lag_24 = series[i - 24]
            roll_6 = np.mean(series[max(0, i - 6) : i])

            x_list.append([h_sin, h_cos, lag_1, lag_2, lag_24, roll_6])
            y_list.append(series[i])

        return np.array(x_list), np.array(y_list)

    def fit(self, historical_df: pd.DataFrame) -> None:
        """Fit 3 quantile boosting models."""
        values = historical_df["intensity"].to_numpy(dtype=float)
        self.last_known_history = values

        if len(values) < 48:
            # Not enough data for lag-24 tree training; fallback simple baseline
            return

        x_train, y_train = self._engineer_features(values)
        if len(x_train) == 0:
            return

        train_data = lgb.Dataset(x_train, label=y_train)

        for q in self.quantiles:
            params = {
                "objective": "quantile",
                "alpha": q,
                "metric": "quantile",
                "boosting_type": "gbdt",
                "num_leaves": 15,
                "learning_rate": 0.05,
                "n_estimators": 50,
                "verbose": -1,
                "random_state": 42,
            }
            booster = lgb.train(params, train_data, num_boost_round=50)
            q_key = f"p{int(q * 100)}"
            self.models[q_key] = booster

    def predict_quantiles(self, horizon_slots: int) -> Dict[str, np.ndarray]:
        """Autoregressive multi-step quantile projection."""
        if not self.models or len(self.last_known_history) < 24:
            # Fallback to mean with Gaussian spread
            mean_val = np.mean(self.last_known_history) if len(self.last_known_history) > 0 else 250.0
            return {
                "p10": np.full(horizon_slots, max(0.0, mean_val - 30.0)),
                "p50": np.full(horizon_slots, mean_val),
                "p90": np.full(horizon_slots, mean_val + 30.0),
            }

        history = list(self.last_known_history)
        preds: Dict[str, List[float]] = {"p10": [], "p50": [], "p90": []}

        for step in range(horizon_slots):
            curr_idx = len(history)
            hour = curr_idx % 24
            h_sin = math.sin(2.0 * math.pi * hour / 24.0)
            h_cos = math.cos(2.0 * math.pi * hour / 24.0)
            lag_1 = history[-1]
            lag_2 = history[-2]
            lag_24 = history[-24]
            roll_6 = np.mean(history[-6:])

            feat = np.array([[h_sin, h_cos, lag_1, lag_2, lag_24, roll_6]])

            p10_val = float(self.models["p10"].predict(feat)[0])
            p50_val = float(self.models["p50"].predict(feat)[0])
            p90_val = float(self.models["p90"].predict(feat)[0])

            # Ensure quantile monotonicity: P10 <= P50 <= P90
            p10_val = max(0.0, p10_val)
            p50_val = max(p10_val, p50_val)
            p90_val = max(p50_val, p90_val)

            preds["p10"].append(p10_val)
            preds["p50"].append(p50_val)
            preds["p90"].append(p90_val)

            # Roll median forward for recursive forecasting
            history.append(p50_val)

        return {k: np.array(v) for k, v in preds.items()}
