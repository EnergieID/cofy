from typing import Literal

from cofy.modules.timeseries import EnergyBalanceSource, EnergyBalanceSourceSettings
from tests.cofy.modules.timeseries.dummy_source import DummyTimeseriesSource


class DummyEnergyBalanceSourceSettings(EnergyBalanceSourceSettings):
    type: Literal["dummy_energy_balance_source"] = "dummy_energy_balance_source"


class DummyEnergyBalanceSource(DummyTimeseriesSource, EnergyBalanceSource, settings=DummyEnergyBalanceSourceSettings):
    """The dummy source, as a source of energy balances."""
