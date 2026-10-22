import datetime as dt

import pytest

from cofy.integrations.demo import DemoBoundarySource
from cofy.modules.directive import DirectiveSeriesSource

START = dt.datetime(2026, 3, 2, tzinfo=dt.UTC)
HOUR = dt.timedelta(hours=1)


@pytest.mark.asyncio
async def test_boundaries_come_in_four_columns():
    source = DemoBoundarySource([(1, 2, 3, 4), (5, 6, 7, 8)])
    timeseries = await source.fetch_timeseries(START + 11 * HOUR, START + 13 * HOUR, HOUR)
    assert timeseries.frame.drop("timestamp").rows() == [(1, 2, 3, 4), (5, 6, 7, 8)]


@pytest.mark.asyncio
async def test_a_directive_can_follow_demo_values():
    source = DirectiveSeriesSource.create(
        {
            "type": "dynamic_boundary_directive",
            "signal_source": {"type": "demo_price"},
            "boundary_source": {"type": "demo_boundary"},
        }
    )
    timeseries = await source.fetch_timeseries(START, START + 24 * HOUR, HOUR)
    assert len(timeseries.frame) == 24
