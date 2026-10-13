r"""Verify the Integer-Scaling Error Bound of CP-SAT with S and 10xS.

@see docs/MATH.md §4.1 and §4.2:
Formula:
    \epsilon_j <= n_{slots}(j) * (0.5 / S)
    Total Error Bound <= \sum_j n_{slots}(j) * (0.5 / S)
"""

import math
from carbonshift.core.types import Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.ingestion import CarbonDataIngestionEngine
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler


def verify_integer_scaling_bound():
    print("=" * 100)
    print("VERIFYING INTEGER-SCALING ERROR BOUND (S=1000 vs 10xS=10000)")
    print("=" * 100)

    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=512, capacity_mem_gb=2048, egress_costs={"uk-north": 0.0, "eu-west": 0.02}),
        Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=512, capacity_mem_gb=2048, egress_costs={"uk-north": 0.02, "eu-west": 0.0}),
    ]
    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(24)
    ]
    power_model = ServerPowerModel()
    ingestion = CarbonDataIngestionEngine()

    max_observed_discrepancy = 0.0
    total_trials = 5

    for trial in range(total_trials):
        seed = 100 + trial * 17
        telemetry = {
            r.id: {
                p.slot_index: p
                for p in ingestion.ingest_and_cache(r.id, num_slots=24, seed=seed)
            }
            for r in regions
        }

        jobs = sample_cluster_trace_jobs(
            num_jobs=30,
            horizon_seconds=86400.0,
            seed=seed,
            available_regions=[r.id for r in regions],
        )

        # Solver with S = 1000
        scheduler_s = CPSatScheduler(integer_scale_carbon=1000, integer_scale_cost=10000, power_model=power_model)
        sched_s = scheduler_s.solve(
            jobs=jobs, regions=regions, slots=slots, carbon_telemetry=telemetry,
            alpha_carbon=1.0, beta_cost=0.0, gamma_risk=0.0,
        )

        # Solver with 10xS = 10000
        scheduler_10s = CPSatScheduler(integer_scale_carbon=10000, integer_scale_cost=100000, power_model=power_model)
        sched_10s = scheduler_10s.solve(
            jobs=jobs, regions=regions, slots=slots, carbon_telemetry=telemetry,
            alpha_carbon=1.0, beta_cost=0.0, gamma_risk=0.0,
        )

        # Theoretical bound: sum over jobs of n_slots * 0.5 / S
        slot_len_sec = 3600.0
        theoretical_bound = sum(
            max(1, math.ceil(j.duration_seconds / slot_len_sec)) * (0.5 / 1000.0)
            for j in jobs
        )

        diff = abs(sched_s.total_carbon_gco2e - sched_10s.total_carbon_gco2e)
        max_observed_discrepancy = max(max_observed_discrepancy, diff)

        print(f"Trial {trial + 1}/{total_trials} (Seed {seed}):")
        print(f"  Carbon (S=1000):   {sched_s.total_carbon_gco2e:.4f} gCO2e")
        print(f"  Carbon (S=10000):  {sched_10s.total_carbon_gco2e:.4f} gCO2e")
        print(f"  Absolute Delta:    {diff:.6f} gCO2e")
        print(f"  Theoretical Bound: {theoretical_bound:.6f} gCO2e")
        print(f"  Status:            {'PASS' if diff <= theoretical_bound else 'FAIL'}")

        assert diff <= theoretical_bound, (
            f"Integer scaling discrepancy {diff} exceeded theoretical bound {theoretical_bound}!"
        )

    print("=" * 100)
    print(f"ALL TRIALS PASSED. Max observed integer-scaling discrepancy: {max_observed_discrepancy:.6f} gCO2e")
    print("=" * 100)
    return max_observed_discrepancy


if __name__ == "__main__":
    verify_integer_scaling_bound()
