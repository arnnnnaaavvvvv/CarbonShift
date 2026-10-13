"""Kubernetes Controller & Scheduling Gate Integration Tests.

Validates:
- Controller intercepts pods labeled 'carbonshift/flexible: "true"' with scheduling gate 'carbonshift.io/gate'
- Assigns dispatch window
- Releases gate when scheduled epoch arrives
- RBAC manifests conform to least-privilege standards without wildcard permissions
"""

import yaml
from pathlib import Path
from carbonshift.k8s.controller import SchedulingGateController, SCHEDULING_GATE_NAME, FLEXIBLE_LABEL_KEY


def test_k8s_scheduling_gate_reconciliation_workflow():
    """Verify pod lifecycle reconciliation through the scheduling gate controller."""
    controller = SchedulingGateController()

    pod_name = "data-pipeline-job-1"
    namespace = "default"
    labels = {FLEXIBLE_LABEL_KEY: "true"}
    gates = [SCHEDULING_GATE_NAME]

    # 1. Intercept flexible gated pod at t=1000s
    intercepted = controller.reconcile_pod_creation(
        pod_name=pod_name,
        namespace=namespace,
        labels=labels,
        scheduling_gates=gates,
        arrival_epoch_s=1000.0,
        deadline_epoch_s=10000.0,
    )
    assert intercepted is True
    assert f"{namespace}/{pod_name}" in controller.gated_pods

    # 2. Non-flexible pod should not be intercepted
    ignored = controller.reconcile_pod_creation(
        pod_name="system-critical-pod",
        namespace=namespace,
        labels={"carbonshift/flexible": "false"},
        scheduling_gates=gates,
        arrival_epoch_s=1000.0,
        deadline_epoch_s=10000.0,
    )
    assert ignored is False

    # 3. Assign optimal dispatch window at t=3600s in region 'eu-west'
    target_start = 3600.0
    controller.assign_dispatch_window(
        pod_name=pod_name,
        namespace=namespace,
        target_region="eu-west",
        scheduled_epoch_s=target_start,
    )

    # 4. Check gate releases before time window opens (t=2000s) -> should be empty
    released_early = controller.evaluate_gate_releases(current_epoch_s=2000.0)
    assert len(released_early) == 0

    # 5. Fast-forward to admitted execution window (t=3610s) -> gate must be released
    released_on_time = controller.evaluate_gate_releases(current_epoch_s=3610.0)
    assert len(released_on_time) == 1
    assert released_on_time[0] == f"{namespace}/{pod_name}"
    assert controller.gated_pods[f"{namespace}/{pod_name}"].is_gate_removed is True


def test_k8s_rbac_manifest_integrity():
    """Verify RBAC manifests conform to least-privilege standards without wildcard permissions."""
    rbac_path = Path(__file__).parent.parent / "k8s" / "controller" / "rbac.yaml"
    assert rbac_path.exists(), "k8s/controller/rbac.yaml does not exist"

    with open(rbac_path, "r") as f:
        manifests = list(yaml.safe_load_all(f))

    # Check ClusterRole exists
    cluster_roles = [m for m in manifests if m.get("kind") == "ClusterRole"]
    assert len(cluster_roles) >= 1
    cr = cluster_roles[0]

    for rule in cr.get("rules", []):
        # Enforce no wildcard resources or verbs
        assert "*" not in rule.get("resources", []), "Wildcard resources found in RBAC!"
        assert "*" not in rule.get("verbs", []), "Wildcard verbs found in RBAC!"
