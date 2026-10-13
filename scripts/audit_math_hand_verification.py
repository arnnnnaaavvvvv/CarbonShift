"""Independent Hand-Verification Script for 10 End-to-End Jobs.

ZERO code is shared with the main CarbonShift implementation.
Computes raw mathematical formulas from first principles and asserts exact equivalence.
@see docs/MATH.md §2 and §3
"""

import math
from typing import Dict, List, Any


def hand_specpower_kw(u: float, p_idle: float = 0.100, p_max: float = 0.500, r: float = 1.4) -> float:
    return p_idle + (p_max - p_idle) * (u ** r)


def hand_overlap(t_start: float, t_end: float, s_start: float, s_end: float) -> float:
    if t_end <= s_start or t_start >= s_end or t_start >= t_end:
        return 0.0
    return (min(t_end, s_end) - max(t_start, s_start)) / (s_end - s_start)


def run_hand_verification() -> List[Dict[str, Any]]:
    # Define 10 distinct job scenarios
    scenarios = [
        {
            "id": "JOB-01-Standard-1Slot",
            "u": 0.5, "duration_s": 3600.0, "t_start": 0.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.0, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [{"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 200.0, "price": 0.15}],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-02-MultiSlot-3Slot-VarIntensity",
            "u": 0.5, "duration_s": 10800.0, "t_start": 0.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.0, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 300.0, "price": 0.20},
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 150.0, "price": 0.12},
                {"idx": 2, "start": 7200.0, "end": 10800.0, "dur_h": 1.0, "intensity": 100.0, "price": 0.10},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-03-PartialOverlap-AcrossSlotBoundary",
            "u": 0.8, "duration_s": 5400.0, "t_start": 1800.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.15, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 300.0, "price": 0.15},
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 150.0, "price": 0.12},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-04-HighPUE-Overhead",
            "u": 0.6, "duration_s": 7200.0, "t_start": 0.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.35, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 250.0, "price": 0.18},
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 180.0, "price": 0.14},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-05-HeavyWANDataTransfer",
            "u": 0.7, "duration_s": 3600.0, "t_start": 3600.0, "data_gb": 500.0, "cross_region": True,
            "pue": 1.12, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 120.0, "price": 0.11},
            ],
            "egress_cost": 0.05,
        },
        {
            "id": "JOB-06-ShortBurstJob-10Minutes",
            "u": 0.9, "duration_s": 600.0, "t_start": 600.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.10, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 400.0, "price": 0.25},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-07-NarrowBoundaryStraddle",
            "u": 0.4, "duration_s": 60.0, "t_start": 3570.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.20, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 350.0, "price": 0.22},
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 180.0, "price": 0.13},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-08-HighUtil-NearSaturation",
            "u": 0.98, "duration_s": 3600.0, "t_start": 0.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.15, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 210.0, "price": 0.16},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-09-IdleLoad-MinimumPower",
            "u": 0.0, "duration_s": 3600.0, "t_start": 0.0, "data_gb": 0.0, "cross_region": False,
            "pue": 1.00, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 500.0, "price": 0.30},
            ],
            "egress_cost": 0.0,
        },
        {
            "id": "JOB-10-ComplexMultiSlotCrossRegion",
            "u": 0.85, "duration_s": 7200.0, "t_start": 1800.0, "data_gb": 120.0, "cross_region": True,
            "pue": 1.18, "p_idle": 0.100, "p_max": 0.500, "r": 1.4,
            "slots": [
                {"idx": 0, "start": 0.0, "end": 3600.0, "dur_h": 1.0, "intensity": 320.0, "price": 0.19},
                {"idx": 1, "start": 3600.0, "end": 7200.0, "dur_h": 1.0, "intensity": 220.0, "price": 0.14},
                {"idx": 2, "start": 7200.0, "end": 10800.0, "dur_h": 1.0, "intensity": 110.0, "price": 0.09},
            ],
            "egress_cost": 0.02,
        },
    ]

    # Import CarbonShift implementation for cross-check
    from carbonshift.core.types import Job, Region, Slot, CarbonPoint
    from carbonshift.energy.power_model import ServerPowerModel
    from carbonshift.energy.carbon_calc import calculate_job_compute_footprint, calculate_transfer_footprint

    power_model = ServerPowerModel()
    results = []

    print("=" * 110)
    print("HAND-VERIFICATION OF 10 JOBS (INDEPENDENT FIRST-PRINCIPLES MATH VS. CODEBASE)")
    print("=" * 110)

    for sc in scenarios:
        # Step 1: Hand arithmetic
        p_kw = hand_specpower_kw(sc["u"], sc["p_idle"], sc["p_max"], sc["r"])
        t_end = sc["t_start"] + sc["duration_s"]

        hand_e_comp = 0.0
        hand_c_comp = 0.0
        hand_cost_comp = 0.0

        step_breakdown = []
        for s in sc["slots"]:
            w = hand_overlap(sc["t_start"], t_end, s["start"], s["end"])
            if w > 0.0:
                e_slot = p_kw * s["dur_h"] * sc["pue"] * w
                c_slot = e_slot * s["intensity"]
                cost_slot = e_slot * s["price"]
                hand_e_comp += e_slot
                hand_c_comp += c_slot
                hand_cost_comp += cost_slot
                step_breakdown.append(f"Slot {s['idx']}: w={w:.4f}, E={e_slot:.6f}kWh, C={c_slot:.6f}g, Cost=${cost_slot:.6f}")

        # Transfer footprint
        if sc["cross_region"] and sc["data_gb"] > 0:
            hand_e_xfer = sc["data_gb"] * 0.014
            hand_c_xfer = hand_e_xfer * 400.0
            hand_cost_xfer = sc["data_gb"] * sc["egress_cost"]
        else:
            hand_e_xfer = 0.0
            hand_c_xfer = 0.0
            hand_cost_xfer = 0.0

        hand_tot_carbon = hand_c_comp + hand_c_xfer
        hand_tot_cost = hand_cost_comp + hand_cost_xfer

        # Step 2: Implementation code
        import uuid
        job_obj = Job(
            id=uuid.uuid4(),
            name=sc["id"],
            duration_seconds=int(sc["duration_s"]),
            cpu_cores=4.0,
            mem_gb=16.0,
            arrival_epoch_s=sc["t_start"],
            deadline_epoch_s=sc["t_start"] + sc["duration_s"] + 3600.0,
            utilization=sc["u"],
            data_size_gb=sc["data_gb"],
            source_region="source_reg",
            region_whitelist=["source_reg", "target_reg"],
        )
        target_reg = Region(
            id="target_reg" if sc["cross_region"] else "source_reg",
            name="Target Region",
            pue=sc["pue"],
            capacity_cores=256,
            capacity_mem_gb=1024,
            egress_costs={"source_reg": 0.0, "target_reg": sc["egress_cost"]},
        )
        slots_obj = [
            Slot(index=s["idx"], start_epoch_s=s["start"], end_epoch_s=s["end"], duration_hours=s["dur_h"])
            for s in sc["slots"]
        ]
        carbon_lookup = {
            s["idx"]: CarbonPoint(
                region_id=target_reg.id,
                slot_index=s["idx"],
                intensity_p10=s["intensity"],
                intensity_p50=s["intensity"],
                intensity_p75=s["intensity"],
                intensity_p90=s["intensity"],
                price_per_kwh=s["price"],
            )
            for s in sc["slots"]
        }

        code_e_comp, code_c_comp, code_cost_comp = calculate_job_compute_footprint(
            job=job_obj,
            start_epoch_s=sc["t_start"],
            region=target_reg,
            slots=slots_obj,
            carbon_lookup=carbon_lookup,
            power_model=power_model,
        )
        code_e_xfer, code_c_xfer, code_cost_xfer = calculate_transfer_footprint(
            data_size_gb=sc["data_gb"],
            src_region_id=job_obj.source_region,
            dst_region_id=target_reg.id,
            egress_cost_per_gb=sc["egress_cost"],
        )
        code_tot_carbon = code_c_comp + code_c_xfer
        code_tot_cost = code_cost_comp + code_cost_xfer

        c_err = abs(hand_tot_carbon - code_tot_carbon)
        k_err = abs(hand_tot_cost - code_tot_cost)

        assert c_err < 1e-11, f"{sc['id']} Carbon mismatch: hand={hand_tot_carbon}, code={code_tot_carbon}"
        assert k_err < 1e-11, f"{sc['id']} Cost mismatch: hand={hand_tot_cost}, code={code_tot_cost}"

        results.append({
            "job_id": sc["id"],
            "u": sc["u"],
            "power_kw": p_kw,
            "duration_s": sc["duration_s"],
            "hand_carbon_g": hand_tot_carbon,
            "code_carbon_g": code_tot_carbon,
            "carbon_err": c_err,
            "hand_cost_usd": hand_tot_cost,
            "code_cost_usd": code_tot_cost,
            "cost_err": k_err,
            "breakdown": step_breakdown,
            "xfer_carbon": hand_c_xfer,
            "xfer_cost": hand_cost_xfer,
        })

        print(f"\n[{sc['id']}]")
        print(f"  P({sc['u']}) = {p_kw:.6f} kW | Duration = {sc['duration_s']}s | Overlaps: {'; '.join(step_breakdown)}")
        if sc['cross_region']:
            print(f"  Transfer: {sc['data_gb']}GB => E_xfer={hand_e_xfer:.4f}kWh, C_xfer={hand_c_xfer:.4f}g, Cost_xfer=${hand_cost_xfer:.4f}")
        print(f"  HAND TOTAL:  Carbon = {hand_tot_carbon:.8f} gCO2e | Cost = ${hand_tot_cost:.8f}")
        print(f"  CODE TOTAL:  Carbon = {code_tot_carbon:.8f} gCO2e | Cost = ${code_tot_cost:.8f}")
        print(f"  DISCREPANCY: Carbon error = {c_err:.2e} | Cost error = {k_err:.2e} [PASS]")

    print("\n" + "=" * 110)
    print("ALL 10 HAND-VERIFIED JOBS MATCH CODEBASE EXACTLY DOWN TO < 1e-11")
    print("=" * 110)
    return results


if __name__ == "__main__":
    run_hand_verification()
