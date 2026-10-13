"""Test API security, health probes, Prometheus metrics, and RBAC."""

import os
from fastapi.testclient import TestClient
from carbonshift.api.app import app

client = TestClient(app)


def test_api_healthz_and_monitoring_probes():
    """Verify /health and /healthz endpoints return 200 OK."""
    res_h = client.get("/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "ok"

    res_hz = client.get("/healthz")
    assert res_hz.status_code == 200
    assert res_hz.json()["status"] == "healthy"


def test_api_prometheus_metrics_endpoint():
    """Verify /metrics returns standard Prometheus plain text format."""
    res_m = client.get("/metrics")
    assert res_m.status_code == 200
    assert res_m.headers["content-type"].startswith("text/plain")
    body = res_m.text
    assert "carbonshift_schedules_total" in body
    assert "carbonshift_jobs_total" in body
    assert "carbonshift_engine_up 1" in body


def test_api_key_auth_enforcement_when_configured(monkeypatch):
    """Verify that when CARBONSHIFT_API_KEY is configured, invalid keys are rejected with 401."""
    monkeypatch.setenv("CARBONSHIFT_API_KEY", "secret-test-token-xyz")

    # Call endpoint with invalid key
    from carbonshift.api.app import verify_api_key
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        verify_api_key(x_api_key="wrong-key")
    assert exc.value.status_code == 401

    # Call endpoint with valid key
    assert verify_api_key(x_api_key="secret-test-token-xyz") is True
