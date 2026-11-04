import datetime as dt
from abc import ABC, abstractmethod
from typing import Any, Literal

from opentelemetry import trace
from pydantic import Field

from cofy.api import BaseSettingsModel, CofyError, FromSettingsMixin, Referable, SourceError, SourceUnauthorizedError

from .cache import CacheSettings, TimeseriesCache
from .model import ISODuration, Timeseries

TRACER = trace.get_tracer(__name__)


class TimeseriesSourceSettings(BaseSettingsModel):
    type: Literal["timeseries_source"] = "timeseries_source"
    cache: CacheSettings | None = Field(
        None,
        description="Keep what this source fetches, to answer repeated requests faster and spare the upstream service.",
        json_schema_extra={"x-advanced": True},
    )

    @classmethod
    def union_annotations(cls) -> tuple[Any, ...]:
        # Wherever a source of this family fits, a reference to a source resource holding one fits too.
        return (Referable("source", family=cls),)


class TimeseriesSource(FromSettingsMixin, ABC, settings=TimeseriesSourceSettings, abstract=True):
    """A source of any timeseries."""

    def __init__(self, cache: CacheSettings | None = None):
        """A source caching what it fetches if `cache` is given, for the source's own max_age unless it says otherwise."""
        self._cache = (
            TimeseriesCache(self._fetch_timeseries, cache, lambda: self.max_age) if cache is not None else None
        )

    async def fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        **kwargs,
    ) -> Timeseries:
        """Fetch timeseries data between start and end datetimes with the given resolution, from the cache if enabled.

        Anything the source raises other than a `CofyError` is a `SourceError`, its cause logged rather than shown.
        """
        attributes = {
            "cofy.source": type(self).__name__,
            "cofy.timeseries.start": start.isoformat(),
            "cofy.timeseries.end": end.isoformat(),
            "cofy.timeseries.resolution": str(resolution),
        }
        with TRACER.start_as_current_span("fetch timeseries", attributes=attributes) as span:
            try:
                if self._cache is not None:
                    timeseries = await self._cache.fetch(start, end, resolution, **kwargs)
                else:
                    timeseries = await self._fetch_timeseries(start, end, resolution, **kwargs)
            except CofyError:
                raise
            except Exception as exc:
                raise _source_error(exc) from exc
            span.set_attributes(_summary(timeseries))
            return timeseries

    @abstractmethod
    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        **kwargs,
    ) -> Timeseries:
        """Fetch the timeseries data itself, uncached."""

    @property
    def cache(self) -> TimeseriesCache | None:
        """The cache this source serves from, if enabled."""
        return self._cache

    @property
    def supported_resolutions(self) -> list[str]:
        """Optionally specify supported resolutions for this source, e.g. ["PT15M", "P1D"]. If empty, all resolutions are supported."""
        return []

    @property
    def extra_args(self) -> dict:
        """Optionally specify extra keyword args that this source supports, e.g. {"country_code": str}. This can be used by the frontend to dynamically generate query forms."""
        return {}

    @property
    def max_age(self) -> dt.timedelta | None:
        """Optionally specify how long fetched data stays valid, used for caching. None means unknown."""
        return None


def _source_error(exc: Exception) -> SourceError:
    # httpx and requests both raise for an error status with the response attached
    response = getattr(exc, "response", None)
    if getattr(response, "status_code", None) in (401, 403):
        return SourceUnauthorizedError("The service this source fetches from rejected its credentials.")
    return SourceError("The source failed to deliver its data.")


def _summary(timeseries: Timeseries) -> dict[str, int | str]:
    frame = timeseries.frame
    summary: dict[str, int | str] = {"cofy.timeseries.rows": len(frame)}
    if len(frame) > 0 and "timestamp" in frame.columns:
        summary["cofy.timeseries.first"] = str(frame.item(0, "timestamp"))
        summary["cofy.timeseries.last"] = str(frame.item(len(frame) - 1, "timestamp"))
    return summary


class NumericSourceSettings(TimeseriesSourceSettings):
    type: Literal["numeric_source"] = "numeric_source"


class NumericSource(TimeseriesSource, settings=NumericSourceSettings, abstract=True):
    """A source of numeric values."""
