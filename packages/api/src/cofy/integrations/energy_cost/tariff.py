from typing import Literal

from pydantic import Field

from cofy.api import Resource, ResourceSettings
from energy_cost import Tariff


class TariffResourceSettings(ResourceSettings):
    type: Literal["tariff"] = "tariff"
    value: Tariff = Field(description="The tariff's versions over time, each with the formulas for its costs.")


class TariffResource(Resource, settings=TariffResourceSettings):
    """An energy cost tariff."""
