"""Rolling-Horizon Re-Planning Coordinator.

Maintains an active scheduling horizon H (e.g. 24h), committing and freezing
decisions within the upcoming delta_t window (e.g. 1h), while re-optimizing pending
workloads as updated carbon forecasts arrive.

@see docs/BLUEPRINT.md §5.2
"""

from typing import Dict, List, Tuple
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Decision, Schedule
from carbonshift.optimizer.cpsat_solver import CPSatScheduler


class RollingHorizonCoordinator:
    """Coordinates rolling horizon dispatching with frozen commitment windows."""

    def __init__(
        self,
        scheduler: CPSatScheduler,
        horizon_slots: int = 24,
        freeze_slots: int = 1,
    ) -> None:
        self.scheduler = scheduler
        self.horizon_slots = horizon_slots
        self.freeze_slots = freeze_slots
        self.committed_decisions: List[Decision] = []

    def plan_step(
        self,
        current_slot_idx: int,
        all_jobs: List[Job],
        regions: List[Region],
        all_slots: List[Slot],
        carbon_telemetry: Dict[str, Dict[int, CarbonPoint]],
    ) -> Tuple[List[Decision], Schedule]:
        """Perform a single planning step at current_slot_idx.

        Returns:
            (newly_committed_decisions, full_horizon_schedule)
        """
        # Active horizon slots
        start_idx = current_slot_idx
        end_idx = min(len(all_slots), start_idx + self.horizon_slots)
        horizon_slots = all_slots[start_idx:end_idx]

        # Filter jobs that have arrived and not yet completed
        pending_jobs = [
            j for j in all_jobs
            if j.id not in {d.job_id for d in self.committed_decisions}
            and j.arrival_epoch_s <= horizon_slots[-1].end_epoch_s
        ]

        # Solve for horizon
        schedule = self.scheduler.solve(
            jobs=pending_jobs,
            regions=regions,
            slots=horizon_slots,
            carbon_telemetry=carbon_telemetry,
        )

        # Freeze decisions within the upcoming [current_slot_idx, current_slot_idx + freeze_slots)
        freeze_threshold = current_slot_idx + self.freeze_slots
        newly_committed = []

        for dec in schedule.decisions:
            if dec.assigned_slot < freeze_threshold:
                self.committed_decisions.append(dec)
                newly_committed.append(dec)

        return newly_committed, schedule
