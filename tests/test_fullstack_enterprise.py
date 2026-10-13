"""Full-stack enterprise API, persistence, and WebSocket integration tests."""

from fastapi.testclient import TestClient
from carbonshift.api.app import app

client = TestClient(app)


def test_fullstack_clusters_crud():
    # 1. Fetch clusters
    res = client.get("/api/v1/clusters")
    assert res.status_code == 200
    clusters = res.json()["clusters"]
    assert len(clusters) >= 4

    # 2. Register new cluster
    res = client.post(
        "/api/v1/clusters",
        json={
            "id": "test-dc-nordic",
            "name": "Nordic Geothermal DC",
            "pue": 1.05,
            "capacity_cores": 256,
            "capacity_mem_gb": 1024,
            "egress_cost_usd_per_gb": 0.01,
        },
    )
    assert res.status_code == 200
    assert res.json()["cluster"]["id"] == "test-dc-nordic"

    # 3. Delete cluster
    res = client.delete("/api/v1/clusters/test-dc-nordic")
    assert res.status_code == 200
    assert res.json()["status"] == "decommissioned"


def test_fullstack_api_keys_crud():
    # 1. Fetch keys
    res = client.get("/api/v1/api-keys")
    assert res.status_code == 200
    keys = res.json()["api_keys"]
    assert len(keys) >= 2

    # 2. Create key
    res = client.post(
        "/api/v1/api-keys",
        json={"name": "Ephemeral Test Worker", "scope": "job_dispatch"},
    )
    assert res.status_code == 200
    key_id = res.json()["id"]

    # 3. Revoke key
    res = client.delete(f"/api/v1/api-keys/{key_id}")
    assert res.status_code == 200
    assert res.json()["status"] == "revoked"


def test_fullstack_alert_dispatch_and_history():
    res = client.post(
        "/api/v1/alerts/test",
        json={
            "webhook_url": "https://hooks.slack.com/services/test",
            "intensity_threshold": 290.0,
            "channel": "slack",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "dispatched"

    res = client.get("/api/v1/alerts/history")
    assert res.status_code == 200
    alerts = res.json()["alerts"]
    assert len(alerts) >= 1


def test_fullstack_websocket_telemetry():
    with client.websocket_connect("/ws/telemetry") as ws:
        frame = ws.receive_json()
        assert frame["type"] == "TELEMETRY_TICK"
        assert "regions" in frame
        assert "global_grid_mean" in frame
