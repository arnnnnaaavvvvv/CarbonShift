"""SQLAlchemy database models for CarbonShift persistence.

@see docs/BLUEPRINT.md §10.1
"""

import json
from datetime import datetime, timezone
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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


class ClusterModel(Base):
    __tablename__ = "clusters"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    pue = Column(Float, nullable=False, default=1.15)
    capacity_cores = Column(Integer, nullable=False, default=256)
    capacity_mem_gb = Column(Integer, nullable=False, default=1024)
    nodes = Column(Integer, nullable=False, default=8)
    status = Column(String(32), nullable=False, default="online")
    clean_mix_pct = Column(Float, nullable=False, default=50.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ApiKeyModel(Base):
    __tablename__ = "api_keys"

    id = Column(String(64), primary_key=True, default=lambda: f"key_{uuid4().hex[:8]}")
    name = Column(String(128), nullable=False)
    key_prefix = Column(String(64), nullable=False)
    scope = Column(String(64), nullable=False, default="Full Admin")
    status = Column(String(32), nullable=False, default="active")
    hashed_key = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AlertLogModel(Base):
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel = Column(String(64), nullable=False, default="slack")
    webhook_url = Column(String(256), nullable=False)
    intensity_threshold = Column(Float, nullable=False)
    event_payload_json = Column(Text, nullable=False)
    dispatched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

