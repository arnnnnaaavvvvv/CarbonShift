"""Synthetic carbon intensity and grid pricing generator.

Simulates diurnal solar/wind oscillations with Ornstein-Uhlenbeck mean-reverting noise.
All generated records carry mandatory tag: data_source='synthetic_v1'.

@see docs/BLUEPRINT.md §9.2
"""

import math
from typing import List
import numpy as np
from carbonshift.core.types import CarbonPoint


def generate_synthetic_carbon_series(
    region_id: str,
    num_slots: int = 48,
    slot_duration_hours: float = 1.0,
    mean_intensity: float = 320.0,
    diurnal_amplitude: float = 140.0,
    theta: float = 0.15,
    sigma: float = 25.0,
    base_price_per_kwh: float = 0.15,
    seed: int = 42,
) -> List[CarbonPoint]:
    """Generate synthetic carbon intensity points with Ornstein-Uhlenbeck noise.

    Formula:
        I(t) = mu + A * sin(2*pi*t/24 + phi) + X_t
        dX_t = theta * (0 - X_t) * dt + sigma * dW_t

    Args:
        region_id: Unique identifier for the region.
        num_slots: Number of time slots to simulate.
        slot_duration_hours: Duration of each slot in hours (e.g. 1.0 or 0.25).
        mean_intensity: Base grid average carbon intensity in gCO2e/kWh.
        diurnal_amplitude: Peak-to-trough solar swing in gCO2e/kWh.
        theta: OU mean-reversion speed.
        sigma: OU volatility scale.
        base_price_per_kwh: Electricity price baseline in USD/kWh.
        seed: Random seed for exact reproducibility.

    Returns:
        List of CarbonPoint records labeled as 'synthetic_v1'.
    """
    rng = np.random.RandomState(seed)
    points: List[CarbonPoint] = []
    
    ou_state = 0.0
    dt = slot_duration_hours

    # Regional phase offset so regions don't peak at identical times
    region_hash = sum(ord(c) for c in region_id)
    phase_shift = (region_hash % 24) * (2.0 * math.pi / 24.0)

    for slot_idx in range(num_slots):
        time_hours = slot_idx * slot_duration_hours
        
        # Diurnal solar cycle: solar peak at mid-day reduces emissions
        diurnal_component = -diurnal_amplitude * math.sin(
            (2.0 * math.pi * (time_hours % 24.0) / 24.0) + phase_shift
        )
        
        # Ornstein-Uhlenbeck step
        dw = rng.normal(0.0, math.sqrt(dt))
        ou_state += -theta * ou_state * dt + sigma * dw
        
        # True expected median
        p50 = max(20.0, mean_intensity + diurnal_component + ou_state)
        
        # Quantiles modeling forecast uncertainty widening
        p10 = max(10.0, p50 - 1.28 * sigma)
        p75 = p50 + 0.67 * sigma
        p90 = p50 + 1.28 * sigma

        # Electricity spot price correlated with fossil peak
        price = max(0.04, base_price_per_kwh * (p50 / mean_intensity))

        points.append(
            CarbonPoint(
                region_id=region_id,
                slot_index=slot_idx,
                intensity_p10=round(p10, 2),
                intensity_p50=round(p50, 2),
                intensity_p75=round(p75, 2),
                intensity_p90=round(p90, 2),
                price_per_kwh=round(price, 4),
                realized_intensity=round(p50, 2),
                data_source="synthetic_v1",
            )
        )

    return points
