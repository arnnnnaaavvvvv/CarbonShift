"""Verification test for the canonical worked numerical example in MATH.md §1.3 and §3.

Must pass with absolute tolerance <= 1e-4.
"""

import pytest
from carbonshift.core.types import Job, Region, Slot, CarbonPoint
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.energy.carbon_calc import (
    calculate_job_compute_footprint,
    calculate_transfer_footprint,
)


def test_canonical_worked_numerical_example():
    """Verify exact formula values from docs/MATH.md §1.3."""
    # 1. Server Power Model
    model = ServerPowerModel(p_idle_kw=0.100, p_max_kw=0.500, curvature_r=1.4)
    power_kw = model.compute_power_kw(0.80)
    assert pytest.approx(power_kw, abs=1e-4) == 0.392675

    # 2. Region & Slots Setup
    region = Region(
        id="uk-north",
        name="UK North",
        pue=1.15,
        capacity_cores=256,
        capacity_mem_gb=1024,
    )

    slot_0 = Slot(index=0, start_epoch_s=0.0, end_epoch_s=3600.0, duration_hours=1.0)
    slot_1 = Slot(index=1, start_epoch_s=3600.0, end_epoch_s=7200.0, duration_hours=1.0)
    slots = [slot_0, slot_1]

    carbon_lookup = {
        0: CarbonPoint(
            region_id="uk-north",
            slot_index=0,
            intensity_p10=280.0,
            intensity_p50=300.0,
            intensity_p75=310.0,
            intensity_p90=330.0,
            price_per_kwh=0.15,
            data_source="uk_eso",
        ),
        1: CarbonPoint(
            region_id="uk-north",
            slot_index=1,
            intensity_p10=140.0,
            intensity_p50=150.0,
            intensity_p75=160.0,
            intensity_p90=175.0,
            price_per_kwh=0.12,
            data_source="uk_eso",
        ),
    }

    # 3. Job starting at t = 1800s, duration 5400s (ends at 7200s)
    job = Job(
        arrival_epoch_s=0.0,
        deadline_epoch_s=10000.0,
        duration_seconds=5400,
        cpu_cores=16.0,
        mem_gb=64.0,
        data_size_gb=100.0,
        source_region="eu-west",  # requires migration
        region_whitelist=["uk-north", "eu-west"],
        utilization=0.80,
    )

    # 4. Compute Footprint
    e_comp, c_comp, cost_comp = calculate_job_compute_footprint(
        job=job,
        start_epoch_s=1800.0,
        region=region,
        slots=slots,
        carbon_lookup=carbon_lookup,
        power_model=model,
        intensity_key="intensity_p50",
    )

    assert pytest.approx(e_comp, abs=1e-4) == 0.677365
    assert pytest.approx(c_comp, abs=1e-4) == 135.4730
    assert pytest.approx(cost_comp, abs=1e-4) == 0.088057

    # 5. Data Transfer Footprint (100 GB from eu-west to uk-north)
    e_xfer, c_xfer, cost_xfer = calculate_transfer_footprint(
        data_size_gb=100.0,
        src_region_id="eu-west",
        dst_region_id="uk-north",
        egress_cost_per_gb=0.02,
        net_intensity_gco2e_per_kwh=400.0,
    )

    assert pytest.approx(e_xfer, abs=1e-4) == 1.40
    assert pytest.approx(c_xfer, abs=1e-4) == 560.0
    assert pytest.approx(cost_xfer, abs=1e-4) == 2.0000

    # 6. Combined Totals
    total_carbon = c_comp + c_xfer
    total_cost = cost_comp + cost_xfer

    assert pytest.approx(total_carbon, abs=1e-4) == 695.4730
    assert pytest.approx(total_cost, abs=1e-4) == 2.088057
