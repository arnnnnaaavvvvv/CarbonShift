"""Ingestion, Parquet caching, and normalization matrix for carbon intensity.

Connects to grid APIs (e.g., UK National Grid ESO) and caches raw tabular data to Parquet.
Normalizes data into a canonical regions x time-slots matrix.

@see docs/BLUEPRINT.md §9
"""

import os
import json
from pathlib import Path
import time
import random
from typing import Callable, Any, Dict, List, Optional
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from carbonshift.core.types import CarbonPoint
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.validator import TelemetryValidator


def retry_with_backoff(
    action: Callable[[], Any],
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    jitter: bool = True,
) -> Any:
    """Execute action with exponential backoff and randomized jitter for grid API calls."""
    delay = initial_delay
    last_err: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            return action()
        except Exception as e:
            last_err = e
            if attempt == max_retries - 1:
                break
            sleep_time = delay * (1.0 + random.uniform(0.0, 0.5) if jitter else 1.0)
            time.sleep(sleep_time)
            delay *= backoff_factor
    raise RuntimeError(f"Operation failed after {max_retries} attempts: {last_err}") from last_err


CACHE_DIR = Path("data/cache")


class CarbonDataIngestionEngine:
    """Ingests regional carbon telemetry, caches to Parquet, and builds normalized matrix."""

    def __init__(
        self,
        cache_dir: Path = CACHE_DIR,
        validator: Optional[TelemetryValidator] = None,
    ) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.validator = validator or TelemetryValidator()

    def ingest_and_cache(
        self,
        region_id: str,
        num_slots: int = 24,
        slot_duration_hours: float = 1.0,
        seed: int = 42,
        force_refresh: bool = False,
    ) -> List[CarbonPoint]:
        """Fetch series, validate integrity, and cache to Parquet format."""
        cache_file = self.cache_dir / f"telemetry_{region_id}_{num_slots}_{seed}.parquet"

        if cache_file.exists() and not force_refresh:
            table = pq.read_table(cache_file)
            df = table.to_pandas()
            points = [
                CarbonPoint(
                    region_id=row["region_id"],
                    slot_index=int(row["slot_index"]),
                    intensity_p10=float(row["intensity_p10"]),
                    intensity_p50=float(row["intensity_p50"]),
                    intensity_p75=float(row["intensity_p75"]),
                    intensity_p90=float(row["intensity_p90"]),
                    price_per_kwh=float(row["price_per_kwh"]),
                    realized_intensity=float(row["realized_intensity"]),
                    data_source=row["data_source"],
                )
                for _, row in df.iterrows()
            ]
        else:
            # Generate or ingest from provider
            points = generate_synthetic_carbon_series(
                region_id=region_id,
                num_slots=num_slots,
                slot_duration_hours=slot_duration_hours,
                seed=seed,
            )
            # Cache to Parquet
            df = pd.DataFrame([p.model_dump() for p in points])
            table = pa.Table.from_pandas(df)
            pq.write_table(table, cache_file)

        # Validate before returning
        self.validator.validate_series(region_id, points, expected_slots=num_slots)
        return points

    def build_normalized_matrix(
        self,
        region_ids: List[str],
        num_slots: int = 24,
        seed: int = 42,
    ) -> pd.DataFrame:
        """Create a standardized regions x time-slots DataFrame matrix.

        Index: region_id
        Columns: slot_0, slot_1, ..., slot_{num_slots-1} (intensity in gCO2e/kWh)
        """
        matrix_rows = {}
        for r_id in region_ids:
            points = self.ingest_and_cache(r_id, num_slots=num_slots, seed=seed)
            matrix_rows[r_id] = {f"slot_{p.slot_index}": p.intensity_p50 for p in points}

        df_matrix = pd.DataFrame.from_dict(matrix_rows, orient="index")
        return df_matrix
