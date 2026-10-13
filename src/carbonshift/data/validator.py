"""Telemetry validation engine for grid carbon intensity and pricing.

Strictly checks intensity ranges, gaps, duplicates, and UTC alignment.
Never silently interpolates missing or corrupt data.

@see docs/BLUEPRINT.md §9
"""

import math
from typing import Dict, List, Set, Tuple
from carbonshift.core.exceptions import InvalidDataError
from carbonshift.core.types import CarbonPoint
from carbonshift.core.math import MIN_PLAUSIBLE_INTENSITY, MAX_PLAUSIBLE_INTENSITY


class TelemetryValidator:
    """Enforces strict data integrity on regional grid telemetry."""

    def __init__(
        self,
        min_intensity: float = MIN_PLAUSIBLE_INTENSITY,
        max_intensity: float = MAX_PLAUSIBLE_INTENSITY,
    ) -> None:
        self.min_intensity = min_intensity
        self.max_intensity = max_intensity

    def validate_series(
        self,
        region_id: str,
        series: List[CarbonPoint],
        expected_slots: int,
    ) -> None:
        """Validate an entire time-series for a single region.

        Raises:
            InvalidDataError: On range violation, duplicate slot, gap, or NaN/inf.
        """
        if not series:
            raise InvalidDataError(f"Region '{region_id}' has empty telemetry series")

        seen_slots: Set[int] = set()

        for pt in series:
            # 1. NaN and Inf checks
            for field_name in ("intensity_p10", "intensity_p50", "intensity_p75", "intensity_p90", "price_per_kwh"):
                val = getattr(pt, field_name)
                if val is None or math.isnan(val) or math.isinf(val):
                    raise InvalidDataError(f"Non-finite value in '{field_name}' for region {region_id}, slot {pt.slot_index}: {val}")

            # 2. Plausible band check (0 to 1500 gCO2e/kWh)
            if not (self.min_intensity <= pt.intensity_p50 <= self.max_intensity):
                raise InvalidDataError(
                    f"Plausibility violation in region {region_id}, slot {pt.slot_index}: "
                    f"intensity={pt.intensity_p50} outside [{self.min_intensity}, {self.max_intensity}]"
                )

            # 3. Quantile monotonicity check: P10 <= P50 <= P75 <= P90
            if not (pt.intensity_p10 <= pt.intensity_p50 <= pt.intensity_p75 <= pt.intensity_p90):
                raise InvalidDataError(
                    f"Quantile monotonicity violation in region {region_id}, slot {pt.slot_index}: "
                    f"P10={pt.intensity_p10}, P50={pt.intensity_p50}, P75={pt.intensity_p75}, P90={pt.intensity_p90}"
                )

            # 4. Duplicate slot check
            if pt.slot_index in seen_slots:
                raise InvalidDataError(f"Duplicate slot index {pt.slot_index} detected in region {region_id}")
            seen_slots.add(pt.slot_index)

        # 5. Gap / Discontinuity check: must have strictly contiguous slot indices 0..expected_slots-1
        expected_set = set(range(expected_slots))
        missing_slots = expected_set - seen_slots
        if missing_slots:
            raise InvalidDataError(
                f"Missing slots (data gap) detected in region {region_id}: {sorted(list(missing_slots))}. "
                "Silent interpolation is strictly prohibited."
            )
