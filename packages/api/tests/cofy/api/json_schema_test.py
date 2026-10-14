from energy_cost.tariff import Tariff
from pydantic import BaseModel

from cofy.api import finalize, schema_without
from cofy.api.module import ModuleSettings
from cofy.modules.discovery import discover_installed_types
from cofy.modules.timeseries.source import TimeseriesSourceSettings

discover_installed_types()


def tariff_schema(*left_out: type[BaseModel]) -> dict:
    finalize()
    return ModuleSettings.registry()["tariff"].model_json_schema(schema_generator=schema_without(left_out))


def test_leaves_a_type_out_of_every_union_offering_it():
    entsoe = TimeseriesSourceSettings.registry()["entsoe_day_ahead"]

    value, ref = tariff_schema(entsoe)["properties"]["source"]["oneOf"]

    assert set(value["discriminator"]["mapping"]) == {"energy_cost"}
    assert {"$ref": "#/$defs/EntsoeDayAheadTariffSourceSettings"} not in value["oneOf"]
    assert ref == {"$ref": "#/$defs/RefSettings"}


def test_a_referable_field_with_no_type_left_only_takes_a_reference():
    sources = TimeseriesSourceSettings.registry()

    schema = tariff_schema(sources["entsoe_day_ahead"], sources["energy_cost"])

    assert schema["properties"]["source"]["oneOf"] == [{"$ref": "#/$defs/RefSettings"}]


def test_a_referable_field_of_a_type_left_out_only_takes_a_reference():
    tariff = tariff_schema(Tariff)["$defs"]["EnergyCostTariffSourceSettings"]["properties"]["tariff"]

    assert tariff["oneOf"] == [{"$ref": "#/$defs/RefSettings"}]


def test_leaves_everything_in_without_types_to_leave_out():
    assert tariff_schema() == ModuleSettings.registry()["tariff"].model_json_schema()
