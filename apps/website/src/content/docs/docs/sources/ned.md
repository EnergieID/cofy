---
title: NED production forecast
description: The forecast production of Dutch solar and wind installations.
sidebar:
  label: NED
  order: 6
---

The `ned_production_forecast` source forecasts what a set of Dutch solar and wind installations will produce, in kWh, from the [Nationaal Energie Dashboard](https://ned.nl/). For each installation it takes NED's forecast for its region and type, scaled to its peak power.

Install: `pip install "cofy-api[ned]"`

Fits: [`timeseries`](/docs/modules/timeseries/) and [`directive`](/docs/modules/directive/).

## Settings

| Field | What it is |
| --- | --- |
| `api_key` | A [secret](/docs/sources/#credentials-secrets) holding a Nationaal Energie Dashboard API key. Required. |
| `installations` | One or more installations, below. Required. |
| `cache` | How to [cache](/docs/sources/#caching) the forecast. Optional. |

Each installation has:

| Field | What it is |
| --- | --- |
| `region` | `Nederland`, a province (`Groningen`, `Friesland`, `Drenthe`, `Overijssel`, `Flevoland`, `Gelderland`, `Utrecht`, `Noord-Holland`, `Zuid-Holland`, `Zeeland`, `Noord-Brabant`, `Limburg`) or `Offshore` |
| `type` | `solar`, `wind` or `wind_offshore`; `wind_offshore` only for `Nederland` or `Offshore` |
| `peak_power` | The installation's peak power, in kW |

## What you get

- The total forecast production of all installations, in kWh per step: per hour, `PT1H`, by default, or per quarter-hour, `PT15M`.
- Forecasts stay valid for 15 minutes, so `cache: {}` works.

## Example

A 100 kW solar park in Utrecht and a 2 MW wind turbine in Zeeland:

```yaml
type: ned_production_forecast
api_key: { type: secret, name: ned_key }
installations:
  - { region: Utrecht, type: solar, peak_power: 100 }
  - { region: Zeeland, type: wind, peak_power: 2000 }
cache: {}
```
