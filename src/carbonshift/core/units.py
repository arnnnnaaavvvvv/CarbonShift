"""Dimensional integrity and canonical unit conversions using Pint.

@see docs/MATH.md §1 for units registry specification.
"""

from pint import UnitRegistry

ureg = UnitRegistry()
Q_ = ureg.Quantity

# Predefined canonical base units
KW = ureg.kilowatt
KWH = ureg.kilowatt_hour
G_CO2E_PER_KWH = ureg.gram / ureg.kilowatt_hour
G_CO2E = ureg.gram
SECOND = ureg.second
HOUR = ureg.hour
GIGABYTE = ureg.gigabyte


def watts_to_kw(watts: float) -> float:
    """Convert Watts to canonical Kilowatts."""
    return float(Q_(watts, ureg.watt).to(KW).magnitude)


def kwh_to_joules(kwh: float) -> float:
    """Convert canonical kWh to Joules."""
    return float(Q_(kwh, KWH).to(ureg.joule).magnitude)


def lbs_per_mwh_to_g_per_kwh(lbs_per_mwh: float) -> float:
    """Convert US EPA / WattTime lbs/MWh to canonical gCO2e/kWh.
    
    1 lb = 453.59237 g, 1 MWh = 1000 kWh -> 0.45359237 factor.
    """
    return lbs_per_mwh * 0.45359237


def kg_per_mwh_to_g_per_kwh(kg_per_mwh: float) -> float:
    """Convert kg/MWh to canonical gCO2e/kWh (1:1 conversion)."""
    return kg_per_mwh


def kg_co2e_to_g_co2e(kg: float) -> float:
    """Convert kilograms of CO2e to canonical grams."""
    return kg * 1000.0


def seconds_to_hours(seconds: float) -> float:
    """Convert seconds to slot duration hours."""
    return seconds / 3600.0
