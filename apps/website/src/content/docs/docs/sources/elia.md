---
title: Elia solar forecast
description: Elia's solar production forecast of a Belgian region.
sidebar:
  label: Elia
  order: 5
---

The `elia_solar_forecast` source provides Elia's most recent solar production forecast for a Belgian region, from [Elia Open Data](https://opendata.elia.be/). It is a percentage of the region's monitored solar capacity, so it shows how sunny it will be regardless of how much solar a region has.

Install: `pip install "cofy-api[elia]"`. No API key needed.

Fits: [`timeseries`](/docs/modules/timeseries/) and [`directive`](/docs/modules/directive/).

## Settings

| Field | What it is |
| --- | --- |
| `region` | The region. `Belgium` if left out. |
| `cache` | How to [cache](/docs/sources/#caching) the forecast. Optional. |

The regions are `Belgium`, `Brussel`, `Antwerpen`, `OostVlaanderen`, `VlaamsBrabant`, `Limburg`, `WestVlaanderen`, `Hainaut`, `Liege`, `Luxembourg`, `Namur` and `BrabantWallon`.

## What you get

- The forecast in %, per hour, `PT1H`, by default, or per quarter-hour, `PT15M`.
- Forecasts stay valid for 15 minutes, so `cache: {}` works.

## Example

```yaml
type: elia_solar_forecast
region: WestVlaanderen
cache: {}
```
