"""Level 3 Machine Learning Predictor for Job Runtime and Energy.

Predicts job execution duration (seconds) and energy (kWh) using LightGBM quantile regression.
Feeds predictions with uncertainty bounds into the CP-SAT optimizer and provides ablation analysis.

@see docs/BLUEPRINT.md §1
"""

from typing import Dict, List, Tuple
import numpy as np
import lightgbm as lgb

from carbonshift.core.types import Job


class JobRuntimeEnergyPredictor:
    """LightGBM predictor estimating duration and energy from job resource telemetry."""

    def __init__(self) -> None:
        self.duration_model: Optional[lgb.Booster] = None
        self.duration_model_p90: Optional[lgb.Booster] = None
        self.energy_model: Optional[lgb.Booster] = None

    def _extract_features(self, jobs: List[Job]) -> np.ndarray:
        """Features: [cpu_cores, mem_gb, data_size_gb, utilization]."""
        feats = []
        for j in jobs:
            feats.append([j.cpu_cores, j.mem_gb, j.data_size_gb, j.utilization])
        return np.array(feats)

    def train_with_time_split(
        self,
        historical_jobs: List[Job],
        true_durations: List[float],
        true_energies: List[float],
        split_ratio: float = 0.8,
    ) -> Dict[str, float]:
        """Train models using strict temporal order split (no random shuffle)."""
        x = self._extract_features(historical_jobs)
        y_dur = np.array(true_durations)
        y_energy = np.array(true_energies)

        n_split = int(len(x) * split_ratio)
        x_train, x_test = x[:n_split], x[n_split:]
        y_dur_train, y_dur_test = y_dur[:n_split], y_dur[n_split:]
        y_e_train, y_e_test = y_energy[:n_split], y_energy[n_split:]

        # Train median duration model
        dur_train_ds = lgb.Dataset(x_train, label=y_dur_train)
        params_dur_p50 = {"objective": "quantile", "alpha": 0.50, "metric": "mae", "verbose": -1, "random_state": 42}
        self.duration_model = lgb.train(params_dur_p50, dur_train_ds, num_boost_round=40)

        # Train P90 upper bound duration model for uncertainty buffer
        params_dur_p90 = {"objective": "quantile", "alpha": 0.90, "metric": "quantile", "verbose": -1, "random_state": 42}
        self.duration_model_p90 = lgb.train(params_dur_p90, dur_train_ds, num_boost_round=40)

        # Train median energy model
        e_train_ds = lgb.Dataset(x_train, label=y_e_train)
        params_e = {"objective": "regression", "metric": "mae", "verbose": -1, "random_state": 42}
        self.energy_model = lgb.train(params_e, e_train_ds, num_boost_round=40)

        # Test evaluation
        dur_pred = self.duration_model.predict(x_test)
        e_pred = self.energy_model.predict(x_test)

        mae_dur = float(np.mean(np.abs(y_dur_test - dur_pred)))
        mae_e = float(np.mean(np.abs(y_e_test - e_pred)))

        return {
            "test_duration_mae_sec": round(mae_dur, 2),
            "test_energy_mae_kwh": round(mae_e, 4),
        }

    def predict_jobs(self, jobs: List[Job]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Predict expected duration (P50), upper-quantile duration (P90), and energy (kWh)."""
        x = self._extract_features(jobs)
        if self.duration_model is None or self.energy_model is None:
            # Fallback heuristic
            dur_p50 = np.array([float(j.duration_seconds) for j in jobs])
            dur_p90 = dur_p50 * 1.2
            energy = np.array([0.5 * (j.duration_seconds / 3600.0) for j in jobs])
            return dur_p50, dur_p90, energy

        dur_p50 = np.maximum(300.0, self.duration_model.predict(x))
        dur_p90 = np.maximum(dur_p50, self.duration_model_p90.predict(x))
        energy = np.maximum(0.01, self.energy_model.predict(x))
        return dur_p50, dur_p90, energy


def run_predictor_ablation(
    jobs: List[Job],
    regions: List[any],
    slots: List[any],
    telemetry: Dict,
    scheduler: any,
    predictor: JobRuntimeEnergyPredictor,
) -> Dict[str, float]:
    """Run before/after ablation study: Ground Truth vs. ML Predicted Runtimes."""
    # 1. Oracle runtime schedule (Ground Truth)
    sched_ground_truth = scheduler.solve(jobs, regions, slots, telemetry)

    # 2. Predicted runtime schedule
    dur_p50, dur_p90, _ = predictor.predict_jobs(jobs)
    predicted_jobs = []
    for idx, j in enumerate(jobs):
        predicted_jobs.append(
            Job(
                id=j.id,
                name=j.name,
                arrival_epoch_s=j.arrival_epoch_s,
                deadline_epoch_s=j.deadline_epoch_s,
                duration_seconds=int(dur_p90[idx]),  # Use risk-adjusted duration
                cpu_cores=j.cpu_cores,
                mem_gb=j.mem_gb,
                data_size_gb=j.data_size_gb,
                source_region=j.source_region,
                region_whitelist=j.region_whitelist,
                utilization=j.utilization,
            )
        )

    sched_predicted = scheduler.solve(predicted_jobs, regions, slots, telemetry)

    return {
        "ground_truth_carbon_gco2e": sched_ground_truth.total_carbon_gco2e,
        "predicted_runtime_carbon_gco2e": sched_predicted.total_carbon_gco2e,
        "delta_carbon_pct": round(
            ((sched_predicted.total_carbon_gco2e - sched_ground_truth.total_carbon_gco2e)
            / sched_ground_truth.total_carbon_gco2e * 100.0), 2
        ) if sched_ground_truth.total_carbon_gco2e > 0 else 0.0,
    }
