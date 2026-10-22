import datetime as dt

import pytest

from cofy.integrations.demo import DemoPriceSource, DemoProductionSource
from cofy.integrations.demo.demo_price import PRICES
from cofy.modules.production import ProductionSource
from cofy.modules.simultaneity import NetVolumeSource, RatioSource
from cofy.modules.tariff import PriceSource

START = dt.datetime(2026, 3, 2, tzinfo=dt.UTC)
HOUR = dt.timedelta(hours=1)
QUARTER = dt.timedelta(minutes=15)


async def values(source, start=START, end=START + dt.timedelta(days=1), resolution=HOUR) -> list[float]:
    timeseries = await source.fetch_timeseries(start, end, resolution)
    return timeseries.frame["value"].to_list()


@pytest.mark.asyncio
async def test_repeats_the_pattern_over_each_period():
    assert await values(DemoPriceSource()) == PRICES
    assert await values(DemoPriceSource([1, 2]), resolution=QUARTER) == [1.0] * 48 + [2.0] * 48


@pytest.mark.asyncio
async def test_a_timestamp_has_the_same_value_whatever_the_start():
    source = DemoPriceSource(noise=0.2)
    day = await values(source)
    assert await values(source, start=START + 5 * HOUR, end=START + 7 * HOUR) == day[5:7]


@pytest.mark.asyncio
async def test_noise_varies_each_value_by_at_most_its_fraction():
    noisy = await values(DemoPriceSource([100.0], noise=0.1))
    assert all(90 <= value <= 110 for value in noisy)
    assert len(set(noisy)) > 1


@pytest.mark.asyncio
async def test_reports_its_unit():
    timeseries = await DemoProductionSource().fetch_timeseries(START, START + HOUR, HOUR)
    assert timeseries.metadata["unit"] == "kWh"


@pytest.mark.parametrize(
    ("family", "type_"),
    [
        (PriceSource, "demo_price"),
        (ProductionSource, "demo_production"),
        (NetVolumeSource, "demo_net_volume"),
        (RatioSource, "demo_ratio"),
    ],
)
@pytest.mark.asyncio
async def test_each_family_has_one_with_example_values(family, type_):
    source = family.create({"type": type_})
    assert len(await values(source)) == 24
