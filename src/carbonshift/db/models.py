"""SQLAlchemy database models for CarbonShift persistence.

@see docs/BLUEPRINT.md §10.1
"""

import json
from datetime import datetime
from uuid import uuid4
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from carbonshift.db.session import Base


class JobModel(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(128), nullable=True)
    arrival_epoch_s = Column(Float, nullable=False)
    deadline_epoch_s = Column(Float, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    cpu_cores = Column(Float, nullable=False)
    mem_gb = Column(Float, nullable=False)
    data_size_gb = Column(Float, default=0.0)
    source_region = Column(String(32), nullable=False)
    region_whitelist_csv = Column(String(256), nullable=False)
    utilization = Column(Float, default=0.8)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScheduleModel(Base):
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    strategy_name = Column(String(64), nullable=False)
    total_carbon_gco2e = Column(Float, nullable=False)
    total_cost_usd = Column(Float, nullable=False)
    deadline_misses = Column(Integer, default=0)
    deadline_miss_rate = Column(Float, default=0.0)
    solver_status = Column(String(32), default="OPTIMAL")
    solve_time_ms = Column(Float, default=0.0)
    optimality_gap = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    decisions = relationship("DecisionModel", back_populates="schedule", cascade="all, delete-orphan")


class DecisionModel(Base):
    __tablename__ = "schedule_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(String(36), ForeignKey("schedules.id"), nullable=False)
    job_id = Column(String(36), nullable=False)
    selected_region = Column(String(32), nullable=False)
    scheduled_start_epoch_s = Column(Float, nullable=False)
    assigned_slot = Column(Integer, nullable=False)
    estimated_carbon_gco2e = Column(Float, nullable=False)
    estimated_cost_usd = Column(Float, nullable=False)
    explanation_json = Column(Text, nullable=False)

    schedule = relationship("ScheduleModel", back_populates="decisions")
