"""Server power model wrapper referencing canonical formulas.

@see carbonshift.core.math
"""

from carbonshift.core.math import compute_server_power_kw


class ServerPowerModel:
    """Non-linear chassis power model calibrated on SPECpower_ssj2008."""

    def __init__(
        self,
        p_idle_kw: float = 0.100,
        p_max_kw: float = 0.500,
        curvature_r: float = 1.4,
    ) -> None:
        self.p_idle_kw = p_idle_kw
        self.p_max_kw = p_max_kw
        self.r = curvature_r

    def compute_power_kw(self, utilization: float) -> float:
        """Route to canonical implementation in core.math."""
        return compute_server_power_kw(
            utilization=utilization,
            p_idle_kw=self.p_idle_kw,
            p_max_kw=self.p_max_kw,
            curvature_r=self.r,
        )
