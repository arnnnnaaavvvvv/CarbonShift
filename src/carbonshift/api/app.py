"""FastAPI REST API engine for CarbonShift with persistence and report export.

Exposes endpoints to submit jobs, compute optimal plans, execute trace replays,
fetch structured explainability records, and generate audit-ready ESG reports.

@see docs/BLUEPRINT.md §10.2
"""

import os
import io
import csv
import json
from uuid import UUID, uuid4
from typing import Dict, List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from carbonshift.core.types import Job, Region, Slot, Schedule, Decision, Explanation
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.baselines.run_now import schedule_run_immediately
from carbonshift.baselines.greedy_carbon import schedule_greedy_lowest_carbon_now
from carbonshift.baselines.delay_greedy import schedule_delay_to_deadline_greedy
from carbonshift.baselines.oracle import schedule_perfect_oracle
from carbonshift.simulator.engine import TraceReplaySimulator
from carbonshift.api.explanations import generate_decision_explanation
from carbonshift.db.session import engine, Base, get_db
from carbonshift.db.models import JobModel, ScheduleModel, DecisionModel

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CarbonShift Engine",
    version="1.0.0",
    description="Carbon-aware batch workload scheduler, simulator, and ESG compliance engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    num_jobs: int = 25
    horizon_hours: int = 24
    seed: int = 42


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/v1/strategies")
def list_strategies():
    """List all supported scheduling strategies."""
    return {
        "strategies": [
            {"id": "run_now", "name": "Baseline A: Run-Immediately", "type": "heuristic"},
            {"id": "greedy_now", "name": "Baseline B: Greedy Lowest-Carbon", "type": "heuristic"},
            {"id": "delay_greedy", "name": "Baseline C: Delay-to-Deadline", "type": "heuristic"},
            {"id": "cpsat_optimizer", "name": "CarbonShift: CP-SAT Global Optimizer", "type": "exact_integer_solver"},
            {"id": "oracle", "name": "Baseline E: Theoretical Oracle", "type": "theoretical_upper_bound"},
        ]
    }


@app.post("/api/v1/jobs")
def submit_jobs(jobs: List[Job], db: Session = Depends(get_db)):
    """Persist batch job submissions."""
    records = []
    for j in jobs:
        m = JobModel(
            id=str(j.id),
            name=j.name,
            arrival_epoch_s=j.arrival_epoch_s,
            deadline_epoch_s=j.deadline_epoch_s,
            duration_seconds=j.duration_seconds,
            cpu_cores=j.cpu_cores,
            mem_gb=j.mem_gb,
            data_size_gb=j.data_size_gb,
            source_region=j.source_region,
            region_whitelist_csv=",".join(j.region_whitelist),
            utilization=j.utilization,
        )
        db.merge(m)
        records.append(str(j.id))
    db.commit()
    return {"status": "submitted", "jobs_count": len(records), "job_ids": records}


@app.post("/api/v1/schedules/plan", response_model=Schedule)
def compute_plan(req: PlanRequest, db: Session = Depends(get_db)):
    """Compute optimal schedule and persist to database."""
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
    schedule = scheduler.solve(
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

    # Persist schedule and allocations
    sched_m = ScheduleModel(
        id=str(schedule.id),
        strategy_name=schedule.strategy_name,
        total_carbon_gco2e=schedule.total_carbon_gco2e,
        total_cost_usd=schedule.total_cost_usd,
        deadline_misses=schedule.deadline_misses,
        deadline_miss_rate=schedule.deadline_miss_rate,
        solver_status=schedule.solver_status,
        solve_time_ms=schedule.solve_time_ms,
        optimality_gap=schedule.optimality_gap,
    )
    db.add(sched_m)

    for d in schedule.decisions:
        dec_m = DecisionModel(
            schedule_id=str(schedule.id),
            job_id=str(d.job_id),
            selected_region=d.selected_region,
            scheduled_start_epoch_s=d.scheduled_start_epoch_s,
            assigned_slot=d.assigned_slot,
            estimated_carbon_gco2e=d.estimated_carbon_gco2e,
            estimated_cost_usd=d.estimated_cost_usd,
            explanation_json=json.dumps(d.explanation.model_dump()),
        )
        db.add(dec_m)
    db.commit()

    return schedule


@app.get("/api/v1/schedules/{schedule_id}")
def get_schedule(schedule_id: str, db: Session = Depends(get_db)):
    """Fetch stored schedule result and decisions."""
    sched = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")

    decisions = []
    for d in sched.decisions:
        decisions.append({
            "job_id": d.job_id,
            "selected_region": d.selected_region,
            "scheduled_start_epoch_s": d.scheduled_start_epoch_s,
            "assigned_slot": d.assigned_slot,
            "estimated_carbon_gco2e": d.estimated_carbon_gco2e,
            "estimated_cost_usd": d.estimated_cost_usd,
            "explanation": json.loads(d.explanation_json),
        })

    return {
        "schedule_id": sched.id,
        "strategy_name": sched.strategy_name,
        "total_carbon_gco2e": sched.total_carbon_gco2e,
        "total_cost_usd": sched.total_cost_usd,
        "deadline_misses": sched.deadline_misses,
        "solver_status": sched.solver_status,
        "solve_time_ms": sched.solve_time_ms,
        "decisions": decisions,
    }


@app.get("/api/v1/decisions/{decision_id}/explanation")
def get_decision_explanation(decision_id: int, db: Session = Depends(get_db)):
    """Fetch explainability card for a specific allocation decision."""
    dec = db.query(DecisionModel).filter(DecisionModel.id == decision_id).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Decision not found")
    return json.loads(dec.explanation_json)


@app.post("/api/v1/schedules/replay")
def run_replay(req: ReplayRequest):
    """Run simulation across all 5 strategies under capacity limits."""
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

    sched_now = schedule_run_immediately(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    sched_grd = schedule_greedy_lowest_carbon_now(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    sched_del = schedule_delay_to_deadline_greedy(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)
    
    scheduler = CPSatScheduler(power_model=DEFAULT_POWER_MODEL)
    sched_opt = scheduler.solve(jobs, DEFAULT_REGIONS, slots, telemetry)
    sched_orc = schedule_perfect_oracle(jobs, DEFAULT_REGIONS, slots, telemetry, DEFAULT_POWER_MODEL)

    sim = TraceReplaySimulator(power_model=DEFAULT_POWER_MODEL)
    r_now = sim.evaluate_schedule(sched_now, jobs, DEFAULT_REGIONS, slots, telemetry)
    r_grd = sim.evaluate_schedule(sched_grd, jobs, DEFAULT_REGIONS, slots, telemetry)
    r_del = sim.evaluate_schedule(sched_del, jobs, DEFAULT_REGIONS, slots, telemetry)
    r_opt = sim.evaluate_schedule(sched_opt, jobs, DEFAULT_REGIONS, slots, telemetry)
    r_orc = sim.evaluate_schedule(sched_orc, jobs, DEFAULT_REGIONS, slots, telemetry)

    base_c = r_now.total_carbon_gco2e
    def s_pct(c): return round(((base_c - c) / base_c * 100.0), 2) if base_c > 0 else 0.0

    return {
        "workload_jobs_count": len(jobs),
        "baseline_run_now": {"carbon_gco2e": r_now.total_carbon_gco2e, "cost_usd": r_now.total_cost_usd, "saved_pct": 0.0},
        "baseline_greedy_now": {"carbon_gco2e": r_grd.total_carbon_gco2e, "cost_usd": r_grd.total_cost_usd, "saved_pct": s_pct(r_grd.total_carbon_gco2e)},
        "baseline_delay_greedy": {"carbon_gco2e": r_del.total_carbon_gco2e, "cost_usd": r_del.total_cost_usd, "saved_pct": s_pct(r_del.total_carbon_gco2e)},
        "carbonshift_optimizer": {
            "carbon_gco2e": r_opt.total_carbon_gco2e,
            "cost_usd": r_opt.total_cost_usd,
            "saved_pct": s_pct(r_opt.total_carbon_gco2e),
            "deadline_miss_rate_pct": r_opt.deadline_miss_rate,
            "solve_time_ms": r_opt.solve_time_ms,
        },
        "theoretical_oracle": {"carbon_gco2e": r_orc.total_carbon_gco2e, "cost_usd": r_orc.total_cost_usd, "saved_pct": s_pct(r_orc.total_carbon_gco2e)},
    }


@app.get("/api/v1/reports/esg")
def export_esg_report(format: str = Query("csv", enum=["csv", "json"])):
    """Download audit-ready ESG emissions abatement report in CSV or JSON format."""
    summary_path = "results/benchmark_summary.json"
    data = {}
    if os.path.exists(summary_path):
        with open(summary_path, "r") as f:
            data = json.load(f)

    if format == "json":
        return data

    # CSV Format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Strategy", "Total Carbon (gCO2e)", "CO2 Saved (%)", "Total Cost (USD)", "Cost Delta (%)", "Deadline Miss Rate (%)"])
    for row in data.get("benchmark_summary", []):
        writer.writerow([
            row["strategy"],
            row["total_carbon_gco2e"],
            row["carbon_saved_pct"],
            row["total_cost_usd"],
            row["cost_delta_pct"],
            row["deadline_miss_rate_pct"],
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=carbonshift_esg_report.csv"},
    )
