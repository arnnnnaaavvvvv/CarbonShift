"""Custom domain exceptions for CarbonShift."""

class CarbonShiftError(Exception):
    """Base exception for all CarbonShift domain errors."""


class ParityViolationError(CarbonShiftError):
    """Raised when CP-SAT solver objective deviates from double-precision simulator replay."""


class InfeasibleScheduleError(CarbonShiftError):
    """Raised when the optimization problem is provably infeasible."""


class DeadlineViolationError(CarbonShiftError):
    """Raised when a scheduled job cannot complete before its deadline."""


class InvalidDataError(CarbonShiftError):
    """Raised when input telemetry or traces violate integrity bounds."""
