import datetime as dt

import polars as pl
from fastapi.testclient import TestClient

from cofy.api import CofyAPI
from cofy.modules.timeseries import ISODuration, Timeseries, TimeseriesModule, TimeseriesSource
from tests.cofy.modules.timeseries.dummy_source import DummyTimeseriesSource

START = dt.datetime(2026, 1, 1, tzinfo=dt.UTC)


class TwoColumnSource(TimeseriesSource):
    """Takes and feeds 1 and 2 at each hour."""

    async def _fetch_timeseries(self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs):
        assert isinstance(resolution, dt.timedelta)
        timestamps = [start + i * resolution for i in range(int((end - start) / resolution))]
        frame = pl.DataFrame({"timestamp": timestamps, "take": 1.0, "feed": 2.0})
        return Timeseries(frame=frame, metadata={"unit": "kWh"})

    @property
    def columns(self) -> dict[str, str]:
        return {"take": "What is taken.", "feed": "What is fed in."}


def client(*modules: TimeseriesModule) -> TestClient:
    app = CofyAPI()
    for module in modules:
        app.include_router(module)
    return TestClient(app)


PARAMS = {"start": START.isoformat(), "end": (START + dt.timedelta(hours=2)).isoformat(), "resolution": "PT1H"}


def test_json_has_a_field_per_column():
    module = TimeseriesModule(source=TwoColumnSource())
    response = client(module).get(module.prefix, params=PARAMS)

    assert response.status_code == 200
    assert response.json()["data"] == [
        {"timestamp": "2026-01-01T00:00:00Z", "take": 1.0, "feed": 2.0},
        {"timestamp": "2026-01-01T01:00:00Z", "take": 1.0, "feed": 2.0},
    ]


def test_csv_has_a_column_per_column():
    module = TimeseriesModule(source=TwoColumnSource())
    response = client(module).get(f"{module.prefix}.csv", params=PARAMS)

    assert response.text.splitlines()[0] == "timestamp,take,feed"


def test_the_schema_describes_the_columns_and_one_value_stays_unchanged():
    volumes = TimeseriesModule(source=TwoColumnSource(), name="volumes")
    schema = client(volumes, TimeseriesModule(source=DummyTimeseriesSource(), name="values")).app.openapi()

    record = schema["components"]["schemas"]["TakeFeedRecord"]
    assert record["required"] == ["timestamp", "take", "feed"]
    assert record["properties"]["feed"]["description"] == "What is fed in."
    assert "DefaultDataType" in schema["components"]["schemas"]
    csv = schema["paths"][f"{volumes.prefix}.csv"]["get"]["responses"]["200"]["content"]["text/csv"]
    assert csv["example"].startswith("timestamp,take,feed\n")


class BreakdownSource(TimeseriesSource):
    """Takes 3 at each hour, 1 of it solar and 2 wind."""

    async def _fetch_timeseries(self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs):
        frame = pl.DataFrame({"timestamp": [start], "take.total": 3.0, "take.solar": 1.0, "take.wind": 2.0})
        return Timeseries(frame=frame)

    @property
    def columns(self) -> dict[str, str]:
        return {"take": "What is taken.", "take.total": "All of it.", "take.solar": "Solar.", "take.wind": "Wind."}


def test_dotted_columns_are_nested_in_json_and_kept_in_csv():
    module = TimeseriesModule(source=BreakdownSource())
    test_client = client(module)

    json = test_client.get(module.prefix, params=PARAMS).json()
    csv = test_client.get(f"{module.prefix}.csv", params=PARAMS).text

    assert json["data"] == [{"timestamp": "2026-01-01T00:00:00Z", "take": {"total": 3.0, "solar": 1.0, "wind": 2.0}}]
    assert csv.splitlines()[0] == "timestamp,take.total,take.solar,take.wind"


def test_the_schema_describes_nested_columns_and_their_groups():
    module = TimeseriesModule(source=BreakdownSource())
    schemas = client(module).app.openapi()["components"]["schemas"]

    take = schemas["TakeRecord"]["properties"]["take"]
    assert take["description"] == "What is taken."
    assert schemas["TakeRecordTake"]["required"] == ["total", "solar", "wind"]
    assert schemas["TakeRecordTake"]["properties"]["solar"]["description"] == "Solar."
