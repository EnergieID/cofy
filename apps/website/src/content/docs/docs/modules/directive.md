---
title: Directive
description: Tell members when to use more or less energy, with a five-step signal.
sidebar:
  order: 5
---

The `directive` module serves a [time series](/docs/modules/timeseries/) of steps telling members when to use energy:

| Step | Meaning |
| --- | --- |
| `++` | A very good moment to use energy |
| `+` | A good moment |
| `0` | Neutral |
| `-` | Better to wait |
| `--` | Use as little as possible |

A directive turns a number into these steps, such as the day-ahead price, a solar forecast or the community's [simultaneity](/docs/modules/simultaneity/).

Install: `pip install "cofy-api[directive]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | A directive source, below. Required. |
| `formats` | The formats to offer: `directive` and `csv`. Only `directive` if left out. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

The `directive` format is JSON, like other time series, with a step as each value and `directive` as the unit:

```json
{
  "metadata": { "start": "…", "end": "…", "format": "json", "resolution": "PT1H", "unit": "directive" },
  "data": [{ "timestamp": "2026-01-01T12:00:00Z", "value": "++" }]
}
```

## Fixed boundaries: the `directive` source

The `directive` source compares each value of a number series with four boundaries, from low to high:

| Value | Step |
| --- | --- |
| up to the first boundary | `--` |
| above the first | `-` |
| above the second | `0` |
| above the third | `+` |
| above the fourth | `++` |

| Field | What it is |
| --- | --- |
| `source` | The number series: any price, production, ratio or net volume source, or a forecast from [Elia](/docs/sources/elia/) or [NED](/docs/sources/ned/). Required. |
| `boundaries` | Four numbers, from low to high, in the unit of the source. Required. |
| `reverse` | Turn the steps around, so that high values give `--`. Use it for prices and simultaneity, where a high value means a bad moment. `false` if left out. |
| `cache` | How to [cache](/docs/sources/#caching) the result. Optional. |

It supports the resolutions of its source.

## Boundaries that change: the `dynamic_boundary_directive` source

The `dynamic_boundary_directive` source works the same way, but takes its four boundaries from a second series, so they can change through the day.

| Field | What it is |
| --- | --- |
| `signal_source` | The number series, as for the `directive` source. Required. |
| `boundary_source` | A series of four boundaries for each moment. Required. |
| `reverse` | As for the `directive` source. |
| `cache` | How to [cache](/docs/sources/#caching) the result. Optional. |

Only moments for which both series have a value get a step. For now the only boundary source is [`demo_boundary`](/docs/sources/demo/).

## Examples

Cheap day-ahead prices are a good moment to use energy, so the steps are reversed:

```yaml
type: directive
name: prices
source:
  type: directive
  source:
    type: entsoe_day_ahead
    country_code: BE
    api_key: { type: secret, name: entsoe_key }
  boundaries: [0, 10, 25, 50]
  reverse: true
```

Sunny hours in Antwerp, from Elia's solar forecast as a percentage of the region's solar capacity:

```yaml
type: directive
name: sun
source:
  type: directive
  source: { type: elia_solar_forecast, region: Antwerpen }
  boundaries: [0, 3, 12, 40]
```
