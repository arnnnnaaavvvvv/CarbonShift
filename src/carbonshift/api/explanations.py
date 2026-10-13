"""Deterministic rule-based explanation generator for scheduling decisions.

Calculates delay applied, region choice, carbon avoided vs. run-now,
forecast confidence, and deadline slack remaining.

@see docs/BLUEPRINT.md §3 and §12
"""

from typing import Dict, List, Optional
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Decision, Explanation


def generate_decision_explanation(
    job: Job,
    assigned_slot: int,
    scheduled_start_epoch_s: float,
    selected_region_id: str,
    carbon_saved_vs_now_gco2e: float,
    cost_delta_vs_now_usd: float,
    carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
) -> Explanation:
    """Generate deterministic, human-readable and audit-ready explainability record."""
    delay_sec = max(0.0, scheduled_start_epoch_s - job.arrival_epoch_s)
    delay_hours = delay_sec / 3600.0

    completion_epoch = scheduled_start_epoch_s + job.duration_seconds
    slack_remaining_sec = max(0.0, job.deadline_epoch_s - completion_epoch)
    slack_remaining_hours = slack_remaining_sec / 3600.0

    # Regional telemetry point for confidence evaluation
    reg_lookup = carbon_telemetry.get(selected_region_id, {})
    c_pt = reg_lookup.get(assigned_slot)
    
    # Forecast confidence score based on spread (P90 - P10) relative to P50
    confidence_score = 0.85
    if c_pt and c_pt.intensity_p50 > 0:
        spread = max(1.0, c_pt.intensity_p90 - c_pt.intensity_p10)
        spread_ratio = spread / c_pt.intensity_p50
        confidence_score = max(0.50, min(0.99, 1.0 - (spread_ratio * 0.25)))

    factors: List[str] = []

    # Spatial shift factor
    is_spatial = (selected_region_id != job.source_region)
    if is_spatial:
        factors.append(
            f"Spatial Shift: Migrated from {job.source_region} to cleaner grid in {selected_region_id} "
            f"(Data transfer: {job.data_size_gb:.1f} GB)."
        )
    else:
        factors.append(f"Retained in origin region {job.source_region} (avoided cross-region WAN egress).")

    # Temporal shift factor
    if delay_hours >= 0.5:
        factors.append(
            f"Temporal Deferral: Paused compute by {delay_hours:.1f} hours to align with renewable generation peak."
        )
    else:
        factors.append("Dispatched immediately (current slot is the lowest-emission window before deadline).")

    # Carbon and cost factor
    if carbon_saved_vs_now_gco2e > 0.0:
        factors.append(f"Avoided {carbon_saved_vs_now_gco2e:.1f} gCO2e vs immediate run-now baseline.")
    
    # Slack guarantee
    factors.append(f"Deadline Slack: {slack_remaining_hours:.1f} hours buffer remaining before strict deadline.")

    return Explanation(
        carbon_saved_vs_now_gco2e=round(carbon_saved_vs_now_gco2e, 2),
        cost_delta_vs_now_usd=round(cost_delta_vs_now_usd, 4),
        delay_hours=round(delay_hours, 2),
        spatial_shift_occurred=is_spatial,
        decision_factors=factors,
    )
