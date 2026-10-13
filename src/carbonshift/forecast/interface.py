"""Abstract interface for grid carbon intensity forecasting.

@see docs/BLUEPRINT.md §6
"""

from abc import ABC, abstractmethod
from typing import Dict, List
import pandas as pd
import numpy as np


class BaseForecaster(ABC):
    """Abstract base forecaster producing P10, P50, and P90 quantile forecasts."""

    @abstractmethod
    def fit(self, historical_df: pd.DataFrame) -> None:
        """Fit model on historical dataframe with ['slot_index', 'intensity']."""

    @abstractmethod
    def predict_quantiles(
        self,
        horizon_slots: int,
    ) -> Dict[str, np.ndarray]:
        """Predict quantile paths for future slots.

        Returns:
            Dict containing 'p10', 'p50', 'p90' numpy arrays of length horizon_slots.
        """
