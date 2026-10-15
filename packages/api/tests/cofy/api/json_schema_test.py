from energy_cost.tariff import Tariff
from pydantic import BaseModel

from cofy.api import finalize, schema_without
from cofy.api.json_schema import NEVER
from cofy.api.module import ModuleSettings
from cofy.modules.discovery import discover_installed_types
from cofy.modules.timeseries.source import TimeseriesSourceSettings

discover_installed_types()


def tariff_schema(*left_out: type[BaseModel]) -> dict:
    finalize()
    return ModuleSettings.registry()["tariff"].model_json_schema(schema_generator=schema_without(left_out))


def test_a_type_left_out_is_one_nothing_is_valid_against():
    entsoe = TimeseriesSourceSettings.registry()["entsoe_day_ahead"]

    schema = tariff_schema(entsoe)

    assert schema["$defs"]["EntsoeDayAheadTariffSourceSettings"] == NEVER
    assert schema["$defs"]["EnergyCostTariffSourceSettings"] != NEVER


def test_a_union_still_lists_the_type_left_out():
    """Which branches to offer is for whatever reads the schema; this only says what is accepted."""
    entsoe = TimeseriesSourceSettings.registry()["entsoe_day_ahead"]

    value, _ref = tariff_schema(entsoe)["properties"]["source"]["oneOf"]

    assert "entsoe_day_ahead" in value["discriminator"]["mapping"]


class MayHold(BaseModel):
    tariffs: list[Tariff | None] = []


def test_a_type_left_out_is_one_nothing_is_valid_against_however_it_is_nested():
    schema = MayHold.model_json_schema(schema_generator=schema_without([Tariff]))

    assert schema["$defs"]["Tariff"] == NEVER


def test_leaves_everything_in_without_types_to_leave_out():
    assert tariff_schema() == ModuleSettings.registry()["tariff"].model_json_schema()
