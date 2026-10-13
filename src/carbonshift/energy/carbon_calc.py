"""Exact multi-slot piecewise carbon and energy calculations.

@see docs/MATH.md §2 for core equations:
- §2.2 Slot energy: E = P * Delta_h * PUE * overlap
- §2.3 Piecewise job carbon: C = sum(E_s * I_s)
- §2.4 Data transfer energy: E_xfer = GB * 0.014 kWh/GB
- §2.5 Total operational cost
"""

from typing import Dict, List, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint
from carbonshift.energy.power_model import ServerPowerModel

NETWORK_KWH_PER_GB = 0.014  # Aslan et al. (2018)
DEFAULT_NET_INTENSITY = 400.0  # gCO2e / kWh


def calculate_slot_overlap(
    t_start: float,
    t_end: float,
    slot_start: float,
    slot_end: float,
) -> float:
    """Compute the fractional overlap of [t_start, t_end] with slot [slot_start, slot_end].

    @see docs/MATH.md §2.3
    Returns:
        Fraction in [0.0, 1.0].
    """
    if t_end <= slot_start or t_start >= slot_end:
        return 0.0
    slot_len = slot_end - slot_start
    if slot_len <= 0.0:
        return 0.0
    overlap_sec = min(t_end, slot_end) - max(t_start, slot_start)
    return max(0.0, min(1.0, overlap_sec / slot_len))


def calculate_job_compute_footprint(
    job: Job,
    start_epoch_s: float,
    region: Region,
    slots: List[Slot],
    carbon_lookup: Dict[int, CarbonPoint],
    power_model: ServerPowerModel,
    intensity_key: str = "intensity_p50",
) -> Tuple[float, float, float]:
    """Calculate compute energy (kWh), carbon (gCO2e), and cost (USD) for a job run.

    @see docs/MATH.md §2.2, §2.3, §2.5
    Returns:
        (total_energy_kwh, total_carbon_gco2e, total_cost_usd)
    """
    duration = job.duration_seconds
    end_epoch_s = start_epoch_s + duration
    power_kw = power_model.compute_power_kw(job.utilization)

    total_energy_kwh = 0.0
    total_carbon_gco2e = 0.0
    total_cost_usd = 0.0

    for slot in slots:
        overlap = calculate_slot_overlap(
            t_start=start_epoch_s,
            t_end=end_epoch_s,
            slot_start=slot.start_epoch_s,
            slot_end=slot.end_epoch_s,
        )
        if overlap <= 0.0:
            continue

        c_pt = carbon_lookup.get(slot.index)
        if c_pt is None:
            continue

        intensity = getattr(c_pt, intensity_key, c_pt.intensity_p50)
        price = c_pt.price_per_kwh

        # Energy for the occupied portion of the slot
        slot_e_kwh = power_kw * slot.duration_hours * region.pue * overlap
        slot_c_gco2e = slot_e_kwh * intensity
        slot_cost_usd = slot_e_kwh * price

        total_energy_kwh += slot_e_kwh
        total_carbon_gco2e += slot_c_gco2e
        total_cost_usd += slot_cost_usd

    return total_energy_kwh, total_carbon_gco2e, total_cost_usd


def calculate_transfer_footprint(
    data_size_gb: float,
    src_region_id: str,
    dst_region_id: str,
    egress_cost_per_gb: float = 0.0,
    net_intensity_gco2e_per_kwh: float = DEFAULT_NET_INTENSITY,
) -> Tuple[float, float, float]:
    """Calculate data transfer energy (kWh), carbon (gCO2e), and cost (USD).

    @see docs/MATH.md §2.4, §2.5
    Returns:
        (transfer_energy_kwh, transfer_carbon_gco2e, transfer_cost_usd)
    """
    if src_region_id == dst_region_id or data_size_gb <= 0.0:
        return 0.0, 0.0, 0.0

    energy_kwh = data_size_gb * NETWORK_KWH_PER_GB
    carbon_gco2e = energy_kwh * net_intensity_gco2e_per_kwh
    cost_usd = data_size_gb * egress_cost_per_gb

    return energy_kwh, carbon_gco2e, cost_usd
