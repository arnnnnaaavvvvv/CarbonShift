"""Tests for Milestone 2: Forecasters, Walk-Forward Evaluator, and Robust Optimizer.

@see docs/BLUEPRINT.md §6
"""

import numpy as np
import pandas as pd
import pytest

from carbonshift.core.types import Region, Slot
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.data.synthetic import generate_synthetic_carbon_series
from carbonshift.data.trace_loader import sample_cluster_trace_jobs
from carbonshift.forecast.naive_seasonal import NaiveSeasonalForecaster
from carbonshift.forecast.lightgbm_model import LightGBMQuantileForecaster
from carbonshift.forecast.evaluator import WalkForwardForecastEvaluator
from carbonshift.optimizer.cpsat_solver import CPSatScheduler
from carbonshift.optimizer.rolling_horizon import RollingHorizonCoordinator


def test_naive_seasonal_and_lightgbm_quantiles():
    """Verify forecasters produce monotonic quantiles P10 <= P50 <= P90."""
    points = generate_synthetic_carbon_series(region_id="uk-north", num_slots=96, seed=42)
    df = pd.DataFrame([{"slot_index": p.slot_index, "intensity": p.intensity_p50} for p in points])

    # 1. Naive Seasonal
    naive = NaiveSeasonalForecaster(season_length=24)
    naive.fit(df.iloc[:72])
    naive_preds = naive.predict_quantiles(24)
    assert np.all(naive_preds["p10"] <= naive_preds["p50"])
    assert np.all(naive_preds["p50"] <= naive_preds["p90"])

    # 2. LightGBM Quantile
    lgb_model = LightGBMQuantileForecaster()
    lgb_model.fit(df.iloc[:72])
    lgb_preds = lgb_model.predict_quantiles(24)
    assert np.all(lgb_preds["p10"] <= lgb_preds["p50"])
    assert np.all(lgb_preds["p50"] <= lgb_preds["p90"])


def test_walk_forward_evaluation_metrics():
    """Verify walk-forward evaluator computes valid error and coverage metrics."""
    points = generate_synthetic_carbon_series(region_id="uk-north", num_slots=96, seed=42)
    df = pd.DataFrame([{"slot_index": p.slot_index, "intensity": p.intensity_p50} for p in points])

    evaluator = WalkForwardForecastEvaluator(horizon_slots=24, step_slots=24, min_train_slots=48)
    naive = NaiveSeasonalForecaster(season_length=24)
    metrics = evaluator.evaluate(naive, df)

    assert "smape_pct" in metrics
    assert "mae_gco2e_per_kwh" in metrics
    assert "pinball_loss_p50" in metrics
    assert "interval_coverage_pct" in metrics
    assert metrics["smape_pct"] >= 0.0
    assert 0.0 <= metrics["interval_coverage_pct"] <= 100.0


def test_robust_optimization_against_p90_carbon():
    """Verify optimizer runs in robust mode with upper quantile (intensity_p90)."""
    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=128, capacity_mem_gb=512),
        Region(id="eu-west", name="EU West", pue=1.12, capacity_cores=128, capacity_mem_gb=512),
    ]
    slots = [Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0) for i in range(12)]
    telemetry = {r.id: {p.slot_index: p for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=12, seed=42)} for r in regions}
    jobs = sample_cluster_trace_jobs(num_jobs=5, horizon_seconds=43200.0, seed=42, available_regions=[r.id for r in regions])

    power_model = ServerPowerModel()
    scheduler = CPSatScheduler(power_model=power_model)
    
    # Robust mode planning against P90
    schedule_p90 = scheduler.solve(
        jobs=jobs,
        regions=regions,
        slots=slots,
        carbon_telemetry=telemetry,
        intensity_quantile="intensity_p90",
    )
    assert schedule_p90.solver_status in ("OPTIMAL", "FEASIBLE")
    assert len(schedule_p90.decisions) == len(jobs)


def test_greedy_fallback_on_timeout():
    """Verify optimizer triggers greedy fallback when max solve time is exceeded."""
    regions = [
        Region(id="uk-north", name="UK North", pue=1.15, capacity_cores=32, capacity_mem_gb=128),
    ]
    slots = [Slot(index=i, start_epoch_s=float(i * 3600), end_epoch_s=float((i + 1) * 3600), duration_hours=1.0) for i in range(6)]
    telemetry = {r.id: {p.slot_index: p for p in generate_synthetic_carbon_series(region_id=r.id, num_slots=6, seed=42)} for r in regions}
    jobs = sample_cluster_trace_jobs(num_jobs=4, horizon_seconds=21600.0, seed=42, available_regions=["uk-north"])

    power_model = ServerPowerModel()
    scheduler = CPSatScheduler(power_model=power_model)
    
    # Impossibly small timeout (1 microsecond) to force fallback
    sched = scheduler.solve(
        jobs=jobs,
        regions=regions,
        slots=slots,
        carbon_telemetry=telemetry,
        max_time_seconds=0.000001,
    )
    assert sched.solver_status == "HEURISTIC_FALLBACK"
    assert len(sched.decisions) == len(jobs)
