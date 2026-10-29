---
title: Demo sources
description: Generated data of every kind, to try COFY without any credentials.
sidebar:
  label: Demo
  order: 7
---

The demo sources generate realistic data, so you can try every module without accounts or API keys.

Install: `pip install "cofy-api[demo]"`

| Source | Data | Fits |
| --- | --- | --- |
| `demo_price` | Prices, in EUR/MWh | `tariff`, `directive` |
| `demo_production` | Solar production, in kWh | `production`, `directive` |
| `demo_net_volume` | Net volume of a connection, in kWh | the `simultaneity` source, `directive` |
| `demo_ratio` | Simultaneity, in % | `simultaneity`, `directive` |
| `demo_boundary` | Four directive boundaries that change through the day | the `dynamic_boundary_directive` source |
| `demo_members` | Example members | `members` |

## Settings

Each series source has realistic defaults, and these settings:

| Field | What it is |
| --- | --- |
| `pattern` | Your own values, spread evenly over each `period`. For `demo_boundary`, each value is a list of four boundaries. |
| `period` | How long the pattern takes before it repeats, as an ISO 8601 duration. A day, `P1D`, if left out. |
| `noise` | Random variation, as a fraction of each value, from 0 to 1. The same moment always gets the same variation. 0 if left out. |
| `cache` | How to [cache](/docs/sources/#caching) the data. Optional; give it a `max_age`. |

Patterns run in UTC, and a weekly pattern starts on a Monday. Any resolution works.

`demo_members` takes a list of `members` instead, with two example members by default.

## Examples

Prices that are low at night and high during the day:

```yaml
type: demo_price
pattern: [30, 30, 50, 70, 90, 110, 90, 50]
noise: 0.1
```

A directive between boundaries that change through the day:

```yaml
type: dynamic_boundary_directive
signal_source: { type: demo_price, noise: 0.1 }
boundary_source: { type: demo_boundary }
```
