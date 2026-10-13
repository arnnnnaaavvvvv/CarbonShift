"""Kubernetes Scheduling Gate Reconciler for Flexible Batch Jobs.

Intercepts batch Jobs/Pods labeled `carbonshift/flexible: "true"`.
Holds them unassigned via native Kubernetes scheduling gate `carbonshift.io/gate`,
and removes the gate when the optimal carbon execution slot arrives.

@see docs/BLUEPRINT.md §13
"""

import logging
import time
from typing import Dict, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("carbonshift.k8s")
SCHEDULING_GATE_NAME = "carbonshift.io/gate"
FLEXIBLE_LABEL_KEY = "carbonshift/flexible"


class GatedPod(BaseModel):
    name: str
    namespace: str
    arrival_time: float
    deadline_time: float
    target_region: Optional[str] = None
    scheduled_slot_time: Optional[float] = None
    is_gate_removed: bool = False


class SchedulingGateController:
    """In-cluster or external controller managing scheduling gates."""

    def __init__(self) -> None:
        self.gated_pods: Dict[str, GatedPod] = {}

    def reconcile_pod_creation(
        self,
        pod_name: str,
        namespace: str,
        labels: Dict[str, str],
        scheduling_gates: List[str],
        arrival_epoch_s: float,
        deadline_epoch_s: float,
    ) -> bool:
        """Handle pod creation event from API server."""
        if labels.get(FLEXIBLE_LABEL_KEY) != "true":
            return False

        pod_key = f"{namespace}/{pod_name}"
        if SCHEDULING_GATE_NAME in scheduling_gates:
            logger.info("Intercepted flexible pod with gate: %s", pod_key)
            self.gated_pods[pod_key] = GatedPod(
                name=pod_name,
                namespace=namespace,
                arrival_time=arrival_epoch_s,
                deadline_time=deadline_epoch_s,
            )
            return True
        return False

    def assign_dispatch_window(
        self,
        pod_name: str,
        namespace: str,
        target_region: str,
        scheduled_epoch_s: float,
    ) -> None:
        """Update pod with solver allocation."""
        pod_key = f"{namespace}/{pod_name}"
        if pod_key in self.gated_pods:
            pod = self.gated_pods[pod_key]
            self.gated_pods[pod_key] = GatedPod(
                name=pod.name,
                namespace=pod.namespace,
                arrival_time=pod.arrival_time,
                deadline_time=pod.deadline_time,
                target_region=target_region,
                scheduled_slot_time=scheduled_epoch_s,
            )
            logger.info("Assigned pod %s to start at %s in region %s", pod_key, scheduled_epoch_s, target_region)

    def evaluate_gate_releases(self, current_epoch_s: float) -> List[str]:
        """Release gates for pods whose scheduled slot has arrived."""
        released: List[str] = []
        for pod_key, pod in self.gated_pods.items():
            if not pod.is_gate_removed and pod.scheduled_slot_time is not None:
                if current_epoch_s >= pod.scheduled_slot_time:
                    logger.info("Releasing scheduling gate for pod: %s", pod_key)
                    pod.is_gate_removed = True
                    released.append(pod_key)
        return released
