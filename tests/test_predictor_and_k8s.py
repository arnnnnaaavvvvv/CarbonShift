"""Tests for Milestone 4: ML Runtime/Energy Predictor and Kubernetes Scheduling Gate Controller.

@see docs/BLUEPRINT.md §1 and §13
"""

import numpy as np
import pytest
from carbonshift.core.types import Job, Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.predictor.runtime_energy import (
    JobRuntimeEnergyPredictor,
    run_predictor_ablation,
)
from carbonshift.k8s.controller import SchedulingGateController, SCHEDULING_GATE_NAME


def test_runtime_energy_predictor_and_ablation():
    """Verify LightGBM training on time split and before/after ablation."""
    jobs = sample_cluster_trace_jobs(num_jobs=30, horizon_seconds=86400.0, seed=42)
    # Generate ground truth durations and energies with correlated noise
    durations = [float(j.duration_seconds) for j in jobs]
    energies = [0.25 * (j.duration_seconds / 3600.0) * (j.cpu_cores / 4.0) for j in jobs]

    predictor = JobRuntimeEnergyPredictor()
    metrics = predictor.train_with_time_split(
        historical_jobs=jobs,
        true_durations=durations,
        true_energies=energies,
        split_ratio=0.7,
    )

    assert "test_duration_mae_sec" in metrics
    assert "test_energy_mae_kwh" in metrics
    assert metrics["test_duration_mae_sec"] >= 0.0

    # Predictions
    dur_p50, dur_p90, energy_pred = predictor.predict_jobs(jobs[:5])
    assert len(dur_p50) == 5
    assert np.all(dur_p50 <= dur_p90)
    assert np.all(energy_pred > 0.0)

    # Ablation run
    regions = [Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=128, capacity_mem_gb=512)]
    slots = [Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0) for i in range(12)]
    telemetry = {"uk-north": {p.slot_index: p for p in generate_synthetic_carbon_series("uk-north", num_slots=12)}}

    scheduler = CPSatScheduler(power_model=ServerPowerModel())
    ablation = run_predictor_ablation(
        jobs=jobs[:4],
        regions=regions,
        slots=slots,
        telemetry=telemetry,
        scheduler=scheduler,
        predictor=predictor,
    )

    assert "ground_truth_carbon_gco2e" in ablation
    assert "predicted_runtime_carbon_gco2e" in ablation


def test_k8s_scheduling_gate_controller():
    """Verify Kubernetes controller pod gating, assignment, and release logic."""
    controller = SchedulingGateController()

    # 1. Non-flexible pod should be ignored
    ignored = controller.reconcile_pod_creation(
        pod_name="static-pod",
        namespace="default",
        labels={"carbonshift/flexible": "false"},
        scheduling_gates=[SCHEDULING_GATE_NAME],
        arrival_epoch_s=100.0,
        deadline_epoch_s=5000.0,
    )
    assert ignored is False

    # 2. Flexible gated pod should be held
    intercepted = controller.reconcile_pod_creation(
        pod_name="batch-pod-01",
        namespace="default",
        labels={"carbonshift/flexible": "true"},
        scheduling_gates=[SCHEDULING_GATE_NAME],
        arrival_epoch_s=100.0,
        deadline_epoch_s=10000.0,
    )
    assert intercepted is True
    assert "default/batch-pod-01" in controller.gated_pods

    # 3. Assign optimal dispatch window (e.g. t = 3600.0 in uk-north)
    controller.assign_dispatch_window(
        pod_name="batch-pod-01",
        namespace="default",
        target_region="uk-north",
        scheduled_epoch_s=3600.0,
    )

    # 4. At t = 2000.0 (before slot), gate should NOT be released
    released_early = controller.evaluate_gate_releases(current_epoch_s=2000.0)
    assert len(released_early) == 0

    # 5. At t = 3601.0 (slot arrived), gate should be released
    released_now = controller.evaluate_gate_releases(current_epoch_s=3601.0)
    assert "default/batch-pod-01" in released_now
    assert controller.gated_pods["default/batch-pod-01"].is_gate_removed is True
