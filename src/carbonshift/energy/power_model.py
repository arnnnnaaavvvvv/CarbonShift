"""SPECpower calibrated non-linear server power model.

@see docs/MATH.md §2.1 for power equation:
P(u) = P_idle + (P_max - P_idle) * u^r [kW]
"""

class ServerPowerModel:
    """Non-linear chassis power model calibrated on SPECpower_ssj2008."""

    def __init__(
        self,
        p_idle_kw: float = 0.100,
        p_max_kw: float = 0.500,
        curvature_r: float = 1.4,
    ) -> None:
        """Initialize power model parameters.

        Args:
            p_idle_kw: Idle server power in kilowatts (default: 0.100 kW = 100 W).
            p_max_kw: Full load server power in kilowatts (default: 0.500 kW = 500 W).
            curvature_r: Empirical exponent (default: 1.4).
        """
        if p_idle_kw < 0.0 or p_max_kw <= p_idle_kw:
            raise ValueError(f"Invalid power bounds: idle={p_idle_kw}, max={p_max_kw}")
        if curvature_r <= 0.0:
            raise ValueError(f"Curvature r must be positive, got {curvature_r}")

        self.p_idle_kw = p_idle_kw
        self.p_max_kw = p_max_kw
        self.r = curvature_r

    def compute_power_kw(self, utilization: float) -> float:
        """Compute server power in kW for a given CPU utilization fraction.

        Args:
            utilization: Effective CPU utilization u in [0.0, 1.0].

        Returns:
            Chassis power consumption in kW.
        """
        u = max(0.0, min(1.0, float(utilization)))
        return self.p_idle_kw + (self.p_max_kw - self.p_idle_kw) * (u ** self.r)
