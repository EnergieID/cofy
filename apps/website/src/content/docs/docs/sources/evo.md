---
title: EvO connection energy balance
description: The forecast or measured energy balance of a connection, from Energie van Ons.
sidebar:
  label: EvO
  order: 4
---

Two sources give the energy balance of a connection from [Energie van Ons](https://energie.vanons.org/) (EvO): per quarter-hour, the kWh the connection takes from the grid (`consumption`) and puts on it (`injection`).

| Source | What it gives |
| --- | --- |
| `evo_forecast` | EvO's forecast: a few days ahead, how far differs per connection, and the past forecasts. EvO only forecasts the net volume, so a quarter-hour either consumes or injects. |
| `evo_allocation` | The measured volumes, as allocated by the grid operator: until a few days ago. A quarter-hour can both consume and inject. |

Install: `pip install "cofy-api[evo]"`

Fits: the [`simultaneity` source](/docs/modules/simultaneity/#the-simultaneity-source) and [`timeseries`](/docs/modules/timeseries/), which serves `consumption` and `injection`, each with its `total`.

## Settings

Both sources take the same settings.

| Field | What it is |
| --- | --- |
| `ean` | The connection's 18-digit EAN. Optional: without one, each request gives it as the `ean` parameter. |
| `credentials` | A [secret](/docs/sources/#credentials-secrets) holding the service account key, in JSON, that EvO provided. Put the JSON on a single line. Required. |
| `cache` | How to [cache](/docs/sources/#caching) the volumes. Optional. |

## What you get

- kWh per quarter-hour, `PT15M`, the only resolution.
- Forecasts stay valid for an hour, allocations for six.
- A quarter-hour EvO has no data for is left out.

`acc_forecast`, the former net volume forecast, still works until it is removed, but no longer fits the simultaneity source.

## Example

Simultaneity across two connections:

```yaml
type: simultaneity
sources:
  - type: evo_forecast
    ean: "541234567890123456"
    credentials: { type: secret, name: evo_credentials }
    cache: {}
  - type: evo_forecast
    ean: "541234567890123457"
    credentials: { type: secret, name: evo_credentials }
    cache: {}
```

The measured volume of any connection, which a request picks with `?ean=`:

```yaml
type: timeseries
name: measured
source:
  type: evo_allocation
  credentials: { type: secret, name: evo_credentials }
  cache: {}
```
