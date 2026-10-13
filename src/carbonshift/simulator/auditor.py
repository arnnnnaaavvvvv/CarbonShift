"""Independent parity auditor.

Verifies that CP-SAT solver integer solutions equal double-precision floating point
recomputations from the simulator within relative tolerance <= 1e-4.

@see docs/MATH.md §1.4.3 and docs/BLUEPRINT.md §4.1
"""

import math
from typing import Dict, List
from carbonshift.core.exceptions import ParityViolationError
from carbonshift.core.types import Job, Region, Slot, CarbonPoint, Schedule
from carbonshift.energy.power_model import ServerPowerModel
from carbonshift.simulator.engine import TraceReplaySimulator


class ParityAuditor:
    """Audits numerical parity between optimizer output and independent simulation."""

    def __init__(self, tolerance: float = 1e-4) -> None:
        self.tolerance = tolerance

    def verify_parity(
        self,
        schedule: Schedule,
        jobs: List[Job],
        regions: List[Region],
        slots: List[Slot],
        telemetry: Dict[str, Dict[int, CarbonPoint]],
        power_model: ServerPowerModel,
    ) -> bool:
        """Verify optimizer total carbon matches simulator independent evaluation.

        Raises:
            ParityViolationError: If relative deviation exceeds tolerance.
        """
        simulator = TraceReplaySimulator(power_model=power_model)
        sim_schedule = simulator.evaluate_schedule(
            schedule=schedule,
            jobs=jobs,
            regions=regions,
            slots=slots,
            realized_telemetry=telemetry,
        )

        solver_carbon = schedule.total_carbon_gco2e
        sim_carbon = sim_schedule.total_carbon_gco2e

        if sim_carbon > 0.0:
            rel_err = abs(solver_carbon - sim_carbon) / sim_carbon
            if rel_err > self.tolerance:
                raise ParityViolationError(
                    f"Solver/Simulator parity failure: solver={solver_carbon:.4f} g, "
                    f"simulator={sim_carbon:.4f} g (rel_err={rel_err:.6e} > {self.tolerance})"
                )

        return True
