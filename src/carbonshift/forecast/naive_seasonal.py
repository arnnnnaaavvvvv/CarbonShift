"""Naive-seasonal baseline forecaster.

Assumes carbon intensity repeats diurnal 24-hour cycles with historical empirical quantiles.

@see docs/BLUEPRINT.md §6
"""

from typing import Dict
import numpy as np
import pandas as pd
from carbonshift.forecast.interface import BaseForecaster


class NaiveSeasonalForecaster(BaseForecaster):
    """Repeats historical seasonal pattern with empirical quantile spread."""

    def __init__(self, season_length: int = 24) -> None:
        self.season_length = season_length
        self.seasonal_profile: np.ndarray = np.array([])
        self.residual_p10: float = -20.0
        self.residual_p90: float = 20.0

    def fit(self, historical_df: pd.DataFrame) -> None:
        """Fit seasonal profile from historical series."""
        values = historical_df["intensity"].to_numpy(dtype=float)
        if len(values) < self.season_length:
            self.seasonal_profile = np.full(self.season_length, np.mean(values))
            return

        # Average by hour of day (modulo season_length)
        profile = []
        for h in range(self.season_length):
            h_vals = values[h :: self.season_length]
            profile.append(np.mean(h_vals) if len(h_vals) > 0 else np.mean(values))
        self.seasonal_profile = np.array(profile)

        # Residuals for quantile spread
        t_indices = np.arange(len(values)) % self.season_length
        residuals = values - self.seasonal_profile[t_indices]
        self.residual_p10 = float(np.percentile(residuals, 10))
        self.residual_p90 = float(np.percentile(residuals, 90))

    def predict_quantiles(self, horizon_slots: int) -> Dict[str, np.ndarray]:
        """Generate P10, P50, and P90 projections."""
        indices = np.arange(horizon_slots) % self.season_length
        p50 = self.seasonal_profile[indices]
        p10 = np.maximum(0.0, p50 + self.residual_p10)
        p90 = p50 + self.residual_p90
        return {"p10": p10, "p50": p50, "p90": p90}
