"""Immutable Pydantic domain models for CarbonShift.

@see docs/BLUEPRINT.md §3 for domain entity specifications.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, ConfigDict


class DomainBase(BaseModel):
    """Base model with immutability and strict validation."""
    model_config = ConfigDict(frozen=True, extra="forbid")


class Job(DomainBase):
    """Batch job requiring carbon-aware scheduling."""
    id: UUID = Field(default_factory=uuid4)
    name: Optional[str] = None
    arrival_epoch_s: float
    deadline_epoch_s: float
    duration_seconds: int
    cpu_cores: float
    mem_gb: float
    data_size_gb: float = 0.0
    source_region: str
    region_whitelist: List[str]
    is_flexible: bool = True
    utilization: float = 0.8  # Default effective CPU utilization factor u in [0, 1]


class Region(DomainBase):
    """Geographic compute region with capacity and efficiency metrics."""
    id: str
    name: str
    pue: float = Field(ge=1.0)
    capacity_cores: int = Field(gt=0)
    capacity_mem_gb: int = Field(gt=0)
    egress_costs: Dict[str, float] = Field(default_factory=dict)  # USD per GB


class Slot(DomainBase):
    """Discrete time allocation slot."""
    index: int
    start_epoch_s: float
    end_epoch_s: float
    duration_hours: float


class CarbonPoint(DomainBase):
    """Telemetry and quantile forecast for a single region and slot."""
    region_id: str
    slot_index: int
    intensity_p10: float
    intensity_p50: float
    intensity_p75: float
    intensity_p90: float
    price_per_kwh: float
    realized_intensity: Optional[float] = None
    data_source: str = "synthetic_v1"


class Explanation(DomainBase):
    """Explainability record for why a specific slot and region were chosen."""
    carbon_saved_vs_now_gco2e: float
    cost_delta_vs_now_usd: float
    delay_hours: float
    spatial_shift_occurred: bool
    decision_factors: List[str]


class Decision(DomainBase):
    """Scheduling decision for an individual job."""
    job_id: UUID
    selected_region: str
    scheduled_start_epoch_s: float
    assigned_slot: int
    estimated_carbon_gco2e: float
    estimated_cost_usd: float
    explanation: Explanation


class Schedule(DomainBase):
    """Global schedule containing decisions for a batch of jobs."""
    id: UUID = Field(default_factory=uuid4)
    strategy_name: str
    decisions: List[Decision]
    total_carbon_gco2e: float
    total_cost_usd: float
    deadline_misses: int = 0
    deadline_miss_rate: float = 0.0
    solver_status: str = "OPTIMAL"  # 'OPTIMAL', 'FEASIBLE', 'HEURISTIC'
    solve_time_ms: float = 0.0
    optimality_gap: float = 0.0
    raw_solver_objective: Optional[float] = None
