"""Exact multi-slot piecewise carbon and energy calculations.

All calculations route through canonical formulas in core.math.
@see docs/MATH.md §2 and carbonshift.core.math
"""

from typing import Dict, List, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.core.math import (
    compute_slot_overlap_fraction,
    compute_slot_energy_kwh,
    compute_slot_carbon_gco2e,
    compute_transfer_footprint,
    precise_fsum,
)


def calculate_slot_overlap(
    t_start: float,
    t_end: float,
    slot_start: float,
    slot_end: float,
) -> float:
    """Canonical wrapper for slot overlap fraction."""
    return compute_slot_overlap_fraction(t_start, t_end, slot_start, slot_end)


def calculate_job_compute_footprint(
    job: Job,
    start_epoch_s: float,
    region: Region,
    slots: List[Slot],
    carbon_lookup: Dict[int, CarbonPoint],
    power_model: ServerPowerModel,
    intensity_key: str = "intensity_p50",
) -> Tuple[float, float, float]:
    """Calculate compute energy (kWh), carbon (gCO2e), and cost (USD) for a job run."""
    duration = job.duration_seconds
    end_epoch_s = start_epoch_s + duration
    power_kw = power_model.compute_power_kw(job.utilization)

    energies: List[float] = []
    carbons: List[float] = []
    costs: List[float] = []

    if not slots:
        return 0.0, 0.0, 0.0

    slot_len = slots[0].end_epoch_s - slots[0].start_epoch_s
    if slot_len > 0.0:
        base_s = slots[0].start_epoch_s
        s_start_idx = max(0, int((start_epoch_s - base_s) // slot_len))
        s_end_idx = min(len(slots), int((end_epoch_s - base_s) / slot_len) + 2)
        active_slots = slots[s_start_idx:s_end_idx]
    else:
        active_slots = slots

    for slot in active_slots:
        overlap = compute_slot_overlap_fraction(
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

        val = getattr(c_pt, intensity_key, None)
        intensity = val if val is not None else c_pt.intensity_p50
        price = c_pt.price_per_kwh

        slot_e = compute_slot_energy_kwh(
            power_kw=power_kw,
            slot_duration_hours=slot.duration_hours,
            pue=region.pue,
            overlap_fraction=overlap,
        )
        slot_c = compute_slot_carbon_gco2e(slot_e, intensity)
        slot_cost = slot_e * price

        energies.append(slot_e)
        carbons.append(slot_c)
        costs.append(slot_cost)

    return precise_fsum(energies), precise_fsum(carbons), precise_fsum(costs)


def calculate_transfer_footprint(
    data_size_gb: float,
    src_region_id: str,
    dst_region_id: str,
    egress_cost_per_gb: float = 0.0,
    net_intensity_gco2e_per_kwh: float = 400.0,
) -> Tuple[float, float, float]:
    """Canonical wrapper for transfer footprint."""
    is_cross = (src_region_id != dst_region_id)
    return compute_transfer_footprint(
        data_size_gb=data_size_gb,
        is_cross_region=is_cross,
        egress_cost_per_gb=egress_cost_per_gb,
        net_intensity_gco2e_per_kwh=net_intensity_gco2e_per_kwh,
    )
