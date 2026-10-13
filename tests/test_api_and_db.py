"""Tests for Milestone 3: FastAPI endpoints, Database Persistence, and Explanations.

@see docs/BLUEPRINT.md §10
"""

import pytest
from fastapi.testclient import TestClient
from carbonshift.api.app import app
from carbonshift.core.types import Job
from carbonshift.api.explanations import generate_decision_explanation


@pytest.fixture
def client():
    return TestClient(app)


def test_api_health_and_strategies(client):
    """Verify health and strategy listing."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": "1.0.0"}

    res_strat = client.get("/api/v1/strategies")
    assert res_strat.status_code == 200
    assert len(res_strat.json()["strategies"]) == 5


def test_api_submit_jobs_and_plan(client):
    """Submit jobs, compute optimal plan, and verify persistence."""
    jobs_payload = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "job-alpha",
            "arrival_epoch_s": 0.0,
            "deadline_epoch_s": 43200.0,
            "duration_seconds": 3600,
            "cpu_cores": 4.0,
            "mem_gb": 16.0,
            "data_size_gb": 10.0,
            "source_region": "uk-north",
            "region_whitelist": ["uk-north", "eu-west"],
            "utilization": 0.8,
        }
    ]

    # 1. Submit jobs
    res_sub = client.post("/api/v1/jobs", json=jobs_payload)
    assert res_sub.status_code == 200
    assert res_sub.json()["jobs_count"] == 1

    # 2. Compute plan
    plan_req = {
        "jobs": jobs_payload,
        "horizon_hours": 12,
        "risk_level": "intensity_p75",
    }
    res_plan = client.post("/api/v1/schedules/plan", json=plan_req)
    assert res_plan.status_code == 200
    plan_data = res_plan.json()
    assert plan_data["solver_status"] in ("OPTIMAL", "FEASIBLE")
    assert len(plan_data["decisions"]) == 1

    schedule_id = plan_data["id"]

    # 3. Retrieve schedule
    res_get = client.get(f"/api/v1/schedules/{schedule_id}")
    assert res_get.status_code == 200
    assert res_get.json()["schedule_id"] == schedule_id
    assert len(res_get.json()["decisions"]) == 1


def test_esg_report_export(client):
    """Test ESG CSV report export."""
    res_csv = client.get("/api/v1/reports/esg?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Strategy,Total Carbon (gCO2e)" in res_csv.text


def test_rule_based_explanation_generator():
    """Verify deterministic rule-based explainability generation."""
    job = Job(
        name="job-01",
        arrival_epoch_s=0.0,
        deadline_epoch_s=28800.0,
        duration_seconds=7200,
        cpu_cores=4.0,
        mem_gb=16.0,
        data_size_gb=25.0,
        source_region="uk-north",
        region_whitelist=["uk-north", "eu-west"],
        utilization=0.8,
    )

    explanation = generate_decision_explanation(
        job=job,
        assigned_slot=3,
        scheduled_start_epoch_s=10800.0,
        selected_region_id="eu-west",
        carbon_saved_vs_now_gco2e=142.5,
        cost_delta_vs_now_usd=-0.045,
        carbon_telemetry={},
    )

    assert explanation.delay_hours == 3.0
    assert explanation.spatial_shift_occurred is True
    assert explanation.carbon_saved_vs_now_gco2e == 142.5
    assert any("Spatial Shift" in f for f in explanation.decision_factors)
    assert any("Temporal Deferral" in f for f in explanation.decision_factors)
