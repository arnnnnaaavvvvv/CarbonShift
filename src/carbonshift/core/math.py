"""Single Source of Truth for all CarbonShift mathematical formulas.

Every mathematical formula in CarbonShift lives here. No other module
is permitted to reimplement these formulas.

@see docs/MATH.md
"""

import math
from typing import List, Sequence, Tuple

FORMULA_VERSION = "1.0.0"
NETWORK_KWH_PER_GB = 0.014  # Aslan et al. (2018)
DEFAULT_NET_INTENSITY = 400.0  # gCO2e / kWh
MIN_PLAUSIBLE_INTENSITY = 0.0
MAX_PLAUSIBLE_INTENSITY = 1500.0


def validate_finite_positive(val: float, name: str, allow_zero: bool = True) -> float:
    """Ensure value is finite and non-negative."""
    if math.isnan(val) or math.isinf(val):
        raise ValueError(f"Value '{name}' is not finite: {val}")
    if allow_zero and val < 0.0:
        raise ValueError(f"Value '{name}' cannot be negative: {val}")
    if not allow_zero and val <= 0.0:
        raise ValueError(f"Value '{name}' must be strictly positive: {val}")
    return val


def compute_server_power_kw(
    utilization: float,
    p_idle_kw: float = 0.100,
    p_max_kw: float = 0.500,
    curvature_r: float = 1.4,
) -> float:
    """SPECpower non-linear server power model: P(u) = P_idle + (P_max - P_idle) * u^r [kW].

    @see docs/MATH.md §2.1
    """
    validate_finite_positive(p_idle_kw, "p_idle_kw")
    validate_finite_positive(p_max_kw, "p_max_kw")
    validate_finite_positive(curvature_r, "curvature_r", allow_zero=False)

    if p_max_kw <= p_idle_kw:
        raise ValueError(f"p_max_kw ({p_max_kw}) must exceed p_idle_kw ({p_idle_kw})")

    u = max(0.0, min(1.0, float(utilization)))
    return p_idle_kw + (p_max_kw - p_idle_kw) * math.pow(u, curvature_r)


def compute_slot_overlap_fraction(
    t_start: float,
    t_end: float,
    slot_start: float,
    slot_end: float,
) -> float:
    """Exact fractional overlap omega_{j,s} of [t_start, t_end] with slot [slot_start, slot_end].

    @see docs/MATH.md §2.3
    """
    validate_finite_positive(t_start, "t_start")
    validate_finite_positive(t_end, "t_end")
    validate_finite_positive(slot_start, "slot_start")
    validate_finite_positive(slot_end, "slot_end")

    if t_end < t_start:
        raise ValueError(f"Job end time ({t_end}) cannot be earlier than start time ({t_start})")
    if slot_end <= slot_start:
        raise ValueError(f"Slot end ({slot_end}) must exceed slot start ({slot_start})")

    # Zero length job or strictly non-overlapping
    if t_end <= slot_start or t_start >= slot_end or math.isclose(t_start, t_end, abs_tol=1e-12):
        return 0.0

    slot_len = slot_end - slot_start
    overlap_duration = min(t_end, slot_end) - max(t_start, slot_start)
    fraction = overlap_duration / slot_len
    return max(0.0, min(1.0, fraction))


def compute_slot_energy_kwh(
    power_kw: float,
    slot_duration_hours: float,
    pue: float,
    overlap_fraction: float,
) -> float:
    """Compute energy in kWh for a slot portion: E_s = P * Delta_h * PUE * omega.

    @see docs/MATH.md §2.2
    """
    validate_finite_positive(power_kw, "power_kw")
    validate_finite_positive(slot_duration_hours, "slot_duration_hours")
    validate_finite_positive(pue, "pue", allow_zero=False)
    validate_finite_positive(overlap_fraction, "overlap_fraction")

    if pue < 1.0:
        raise ValueError(f"PUE must be >= 1.0, got {pue}")

    return power_kw * slot_duration_hours * pue * overlap_fraction


def compute_slot_carbon_gco2e(energy_kwh: float, intensity_gco2e_per_kwh: float) -> float:
    """Compute carbon emissions for energy consumed: C_s = E_s * I_s [gCO2e].

    @see docs/MATH.md §2.3
    """
    validate_finite_positive(energy_kwh, "energy_kwh")
    validate_finite_positive(intensity_gco2e_per_kwh, "intensity_gco2e_per_kwh")
    return energy_kwh * intensity_gco2e_per_kwh


def compute_transfer_footprint(
    data_size_gb: float,
    is_cross_region: bool,
    egress_cost_per_gb: float = 0.0,
    network_kwh_per_gb: float = NETWORK_KWH_PER_GB,
    net_intensity_gco2e_per_kwh: float = DEFAULT_NET_INTENSITY,
) -> Tuple[float, float, float]:
    """Data transfer energy, carbon, and egress cost.

    @see docs/MATH.md §2.4, §2.5
    Returns: (energy_kwh, carbon_gco2e, cost_usd)
    """
    validate_finite_positive(data_size_gb, "data_size_gb")
    validate_finite_positive(egress_cost_per_gb, "egress_cost_per_gb")

    if not is_cross_region or data_size_gb == 0.0:
        return 0.0, 0.0, 0.0

    energy_kwh = data_size_gb * network_kwh_per_gb
    carbon_gco2e = energy_kwh * net_intensity_gco2e_per_kwh
    cost_usd = data_size_gb * egress_cost_per_gb
    return energy_kwh, carbon_gco2e, cost_usd


def kahan_sum(values: Sequence[float]) -> float:
    """Kahan compensated summation algorithm to minimize numerical floating-point drift."""
    sum_val = 0.0
    c = 0.0
    for v in values:
        if math.isnan(v) or math.isinf(v):
            raise ValueError(f"Encountered non-finite value in summation: {v}")
        y = v - c
        t = sum_val + y
        c = (t - sum_val) - y
        sum_val = t
    return sum_val


def precise_fsum(values: Sequence[float]) -> float:
    """Exact float summation using IEEE-754 intermediate precision (math.fsum)."""
    return math.fsum(values)


def differential_recompute(
    job_tuples: List[Tuple[float, float, float, float, float, float]],
    transfer_tuples: List[Tuple[float, bool, float]],
) -> Tuple[float, float]:
    """Secondary, intentionally simple float recomputation for differential checking.

    job_tuple: (power_kw, slot_duration_hours, pue, overlap, intensity, price_per_kwh)
    transfer_tuple: (data_gb, is_cross_region, egress_price)
    """
    total_c = 0.0
    total_cost = 0.0
    for p, d, pue, w, i, price in job_tuples:
        e = p * d * pue * w
        total_c += e * i
        total_cost += e * price
    for gb, cross, egress in transfer_tuples:
        if cross and gb > 0.0:
            e_x = gb * NETWORK_KWH_PER_GB
            total_c += e_x * DEFAULT_NET_INTENSITY
            total_cost += gb * egress
    return total_c, total_cost

