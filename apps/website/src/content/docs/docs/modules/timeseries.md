---
title: Time series
description: Serve any time series, and how every time series module is asked for data.
sidebar:
  order: 7
---

The `timeseries` module serves the data of any time series source as it is. Use it for data that has no module of its own, such as a solar forecast from [Elia](/docs/sources/elia/) or [NED](/docs/sources/ned/).

The [`tariff`](/docs/modules/tariff/), [`production`](/docs/modules/production/), [`simultaneity`](/docs/modules/simultaneity/) and [`directive`](/docs/modules/directive/) modules are time series modules too: they serve a more specific kind of series, and are asked for data the same way. This page describes that once, for all of them.

Install: `pip install "cofy-api[timeseries]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | Any time series source. Required. |
| `formats` | `json` and `csv`, the defaults. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

## Example

Elia's solar forecast for Antwerp, at `/timeseries/solar/v1`:

```yaml
type: timeseries
name: solar
source: { type: elia_solar_forecast, region: Antwerpen }
```

The unit is in the answer's metadata.

## Asking for a period

| Parameter | What it is |
| --- | --- |
| `start` | The first moment, in ISO 8601, such as `2026-01-01T00:00:00+01:00` |
| `end` | The moment after the last value |
| `limit` | How many values, instead of an `end` |
| `offset` | Moves both `start` and `end` by this many steps |
| `resolution` | The step between values, as an ISO 8601 duration, such as `PT15M` or `PT1H` |

- If you leave out `start`, it is a day ago; if you leave out both `end` and `limit`, the series runs until now. The [tariff module](/docs/modules/tariff/) looks ahead instead.
- If you send both `end` and `limit`, the later of the two ends wins.
- A time without a time zone is taken as UTC. Timestamps in the answer are always in UTC.
- The `resolution` must be one the source supports; each source page lists them. If a source supports only one, the parameter is left out of the API documentation.
- Some sources add parameters of their own, such as `country_code` for [ENTSO-E](/docs/sources/entsoe/).

## Formats

Every time series module serves its first format at its address, and every other format at the address followed by the format's name. With the defaults:

- `/timeseries/solar/v1` serves JSON:

  ```json
  {
    "metadata": { "start": "…", "end": "…", "format": "json", "resolution": "PT1H", "unit": "%" },
    "data": [{ "timestamp": "2026-01-01T12:00:00Z", "value": 42.1 }]
  }
  ```

- `/timeseries/solar/v1.csv` serves CSV with the columns `timestamp,value`, and the same metadata in an `x-metadata` header.

A module's `formats` setting lists the formats it offers, in order. Some modules have formats of their own, like the tariff module's [`kiwatt`](/docs/modules/tariff/#the-kiwatt-format) and the directive module's [`directive`](/docs/modules/directive/).

## Caching

When a source says how long its data stays valid, the answer carries a `Cache-Control: max-age` header, so clients and proxies can cache it too. How a source caches what it fetches is set on the source; see [caching](/docs/sources/#caching).
