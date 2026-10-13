"""FastAPI REST API engine for CarbonShift.

Exposes scheduling, replay benchmarking, and ESG compliance endpoints.

@see docs/BLUEPRINT.md §10.2
"""

from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from carbonshift.core.types import Job, Region, Slot, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.baselines.run_now import schedule_run_immediately
from carbonshift.baselines.greedy_carbon import schedule_greedy_lowest_carbon_now
from carbonshift.baselines.delay_greedy import schedule_delay_to_deadline_greedy
from carbonshift.baselines.oracle import schedule_perfect_oracle
from carbonshift.simulator.engine import TraceReplaySimulator
from carbonshift.metrics.bootstrap import compute_trace_day_bootstrap_ci

app = FastAPI(
    title="CarbonShift Engine",
    version="1.0.0",
    description="Carbon-aware batch workload scheduler and trace-replay benchmark engine",
)

# In-memory default topology
DEFAULT_REGIONS = [
    Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=256, capacity_mem_gb=1024, egress_costs={"uk-north": 0.0, "eu-west": 0.02, "us-east": 0.05}),
    Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=512, capacity_mem_gb=2048, egress_costs={"uk-north": 0.02, "eu-west": 0.0, "us-east": 0.05}),
    Region(id="us-east", name="US East", pue=1.20, capacity_cores=1024, capacity_mem_gb=4096, egress_costs={"uk-north": 0.05, "eu-west": 0.05, "us-east": 0.0}),
]

DEFAULT_POWER_MODEL = ServerPowerModel()


class PlanRequest(BaseModel):
    jobs: List[Job]
    horizon_hours: int = 24
    risk_level: str = "intensity_p75"
    alpha_carbon: float = 1.0
    beta_cost: float = 0.1
    gamma_risk: float = 0.5
    safety_margin_slots: int = 1


class ReplayRequest(BaseModel):
    num_jobs: int = 30
    horizon_hours: int = 24
    seed: int = 42


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/v1/forecasts/{region_id}")
def get_forecasts(region_id: str, num_slots: int = 24):
    points = generate_synthetic_carbon_series(region_id=region_id, num_slots=num_slots)
    return {"region_id": region_id, "slots": [p.model_dump() for p in points]}


@app.post("/api/v1/schedules/plan", response_model=Schedule)
def compute_plan(req: PlanRequest):
    num_slots = req.horizon_hours
    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(num_slots)
    ]
    telemetry = {
        r.id: {
            p.slot_index: p
            for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=num_slots)
        }
        for r in DEFAULT_REGIONS
    }

    scheduler = CPSatScheduler(power_model=DEFAULT_POWER_MODEL)
    return scheduler.solve(
        jobs=req.jobs,
        regions=DEFAULT_REGIONS,
        slots=slots,
        carbon_telemetry=telemetry,
        alpha_carbon=req.alpha_carbon,
        beta_cost=req.beta_cost,
        gamma_risk=req.gamma_risk,
        safety_margin_slots=req.safety_margin_slots,
        intensity_quantile=req.risk_level,
    )


@app.post("/api/v1/schedules/replay")
def run_replay(req: ReplayRequest):
    num_slots = req.horizon_hours
    slots = [
        Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0)
        for i in range(num_slots)
    ]
    telemetry = {
        r.id: {
            p.slot_index: p
            for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=num_slots, seed=req.seed)
        }
        for r in DEFAULT_REGIONS
    }

    jobs = sample_cluster_trace_jobs(
        num_jobs=req.num_jobs,
        horizon_seconds=float(req.horizon_hours * 3600),
        seed=req.seed,
        available_regions=[r.id for r in DEFAULT_REGIONS],
    )

    # 1. Run all strategies
    sched_now = schedule_run_immediately(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    sched_greedy = schedule_greedy_lowest_carbon_now(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    sched_delay = schedule_delay_to_deadline_greedy(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    
    scheduler = CPSatScheduler(power_model=DEFAULT_POWER_MODEL)
    sched_opt = scheduler.solve(jobs, DEFAULT_REGIONS, slots, telemetry)
    sched_oracle = schedule_perfect_oracle(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)

    # 2. Simulate ground-truth realized replay
    simulator = TraceReplaySimulator(power_model=DEFAULT_POWER_MODEL)
    res_now = simulator.evaluate_schedule(sched_now, jobs, DEFAULT_REGIONS, slots, telemetry)
    res_greedy = simulator.evaluate_schedule(sched_greedy, jobs, DEFAULT_REGIONS, slots, telemetry)
    res_delay = simulator.evaluate_schedule(sched_delay, jobs, DEFAULT_REGIONS, slots, telemetry)
    res_opt = simulator.evaluate_schedule(sched_opt, jobs, DEFAULT_REGIONS, slots, telemetry)
    res_oracle = simulator.evaluate_schedule(sched_oracle, jobs, DEFAULT_REGIONS, slots, telemetry)

    base_c = res_now.total_carbon_gco2e
    def savings(c_val: float) -> float:
        return round(((base_c - c_val) / base_c) * 100.0, 2) if base_c > 0 else 0.0

    return {
        "workload_jobs_count": len(jobs),
        "baseline_run_now": {
            "total_carbon_gco2e": res_now.total_carbon_gco2e,
            "total_cost_usd": res_now.total_cost_usd,
            "carbon_savings_pct": 0.0,
        },
        "baseline_greedy_now": {
            "total_carbon_gco2e": res_greedy.total_carbon_gco2e,
            "total_cost_usd": res_greedy.total_cost_usd,
            "carbon_savings_pct": savings(res_greedy.total_carbon_gco2e),
        },
        "baseline_delay_greedy": {
            "total_carbon_gco2e": res_delay.total_carbon_gco2e,
            "total_cost_usd": res_delay.total_cost_usd,
            "carbon_savings_pct": savings(res_delay.total_carbon_gco2e),
        },
        "carbonshift_optimizer": {
            "total_carbon_gco2e": res_opt.total_carbon_gco2e,
            "total_cost_usd": res_opt.total_cost_usd,
            "carbon_savings_pct": savings(res_opt.total_carbon_gco2e),
            "deadline_miss_rate_pct": res_opt.deadline_miss_rate,
            "solver_time_ms": res_opt.solve_time_ms,
        },
        "theoretical_oracle": {
            "total_carbon_gco2e": res_oracle.total_carbon_gco2e,
            "total_cost_usd": res_oracle.total_cost_usd,
            "carbon_savings_pct": savings(res_oracle.total_carbon_gco2e),
        },
    }
