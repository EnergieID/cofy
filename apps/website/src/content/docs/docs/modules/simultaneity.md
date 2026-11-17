---
title: Simultaneity
description: Serve local production as a percentage of the consumption at the same time.
sidebar:
  order: 4
---

The `simultaneity` module serves, as a [time series](/docs/modules/timeseries/), how well a community's energy production and consumption match up: its production as a percentage of its consumption. 100% means that, at that moment, production matches consumption. Below 100%, members need more than is produced; above 100%, more is produced than they use.

Install: `pip install "cofy-api[simultaneity]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | Where the percentages come from. Required. |
| `formats` | `json` and `csv`, the defaults. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

### Sources

| Source | Percentages |
| --- | --- |
| `simultaneity` | Calculated from the energy balance of the community's connections, below |
| [`demo_ratio`](/docs/sources/demo/) | Generated percentages, to try things out |

## The simultaneity source

The `simultaneity` source adds up the energy balance of a set of connections: what each one takes from the grid and what it puts on it. For every moment it divides all that is put on the grid by all that is taken from it.

| Field | What it is |
| --- | --- |
| `sources` | One or more energy balance sources, such as [`evo_allocation`](/docs/sources/evo/). Required. |
| `cache` | How to [cache](/docs/sources/#caching) the result. Optional. |

- When there is neither consumption nor production, simultaneity is 100%; production without consumption is infinite.
- A moment for which any of its sources has no data is left out.
- It supports the resolutions all its sources support, and its data stays valid as long as that of its shortest-lived source.

Because the result is a number, the simultaneity source also fits a [directive](/docs/modules/directive/), to tell members when to use energy.

## Example

```yaml
type: simultaneity
name: pilot
source:
  type: simultaneity
  sources:
    - type: evo_forecast
      ean: "541234567890123456"
      credentials: { type: secret, name: evo_credentials }
      cache: { max_age: PT15M }
```
