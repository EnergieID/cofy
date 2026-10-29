---
title: Energy-cost tariff
description: Serve the prices of your own tariff, written in energy-cost's format.
sidebar:
  label: Energy cost
  order: 2
---

The `energy_cost` source serves the prices of a tariff you write yourself, in [energy-cost's tariff format](/docs/energy-cost/tariffs/): a fixed price, a time-of-use price, or a price that follows the day-ahead market.

Install: `pip install "cofy-api[tariff,energy-cost]"`

Fits: [`tariff`](/docs/modules/tariff/), [`directive`](/docs/modules/directive/) and [`timeseries`](/docs/modules/timeseries/).

## Settings

| Field | What it is |
| --- | --- |
| `tariff` | The [tariff](/docs/energy-cost/tariffs/): a list of versions, or a [resource](#sharing-a-tariff) holding one. Required. |
| `cost_group` | Which prices to serve: `consumption`, `injection`, `capacity` or `fixed`. If left out, each request picks one with a `cost_group` parameter, `consumption` by default. |
| `cache` | How to [cache](/docs/sources/#caching) prices. Optional; give it a `max_age`. |

## What you get

- Prices in EUR/MWh: the sum of the cost types in the chosen group.
- Resolutions `PT5M`, `PT15M`, `PT1H`, `P1D` and `P7D`.
- A tariff that [follows an index](/docs/energy-cost/tariffs/#price-per-mwh) can only be asked for at the resolution of that index, such as `PT15M`.

Only [prices per MWh](/docs/energy-cost/tariffs/#price-per-mwh) and [time of use](/docs/energy-cost/tariffs/#time-of-use) can be served as a price per moment. Fixed amounts, tiers, lowest-or-highest, by-meter-type and capacity prices can't.

## Example

A dynamic tariff following the Belgian day-ahead price, at `/tariff/dynamic/v1`, and its injection price at `/tariff/dynamic/v1?cost_group=injection`:

```yaml
type: tariff
name: dynamic
description: Our dynamic tariff, following the Belpex.
source:
  type: energy_cost
  tariff:
    - start: 2024-01-01T00:00:00+01:00
      consumption:
        constant_cost: 10.0
        variable_costs:
          - { index: Belpex15min, scalar: 1.05 }
      injection:
        constant_cost: 14.56
        variable_costs:
          - { index: Belpex15min, scalar: -0.9876 }
```

The index has to be known to the COFY API; ask whoever runs it which indexes are available.

## Sharing a tariff

A tariff used in several places can be a [resource](/docs/concepts/#resource) of type `tariff`:

```yaml
resources:
  - type: tariff
    name: dynamic
    value:
      - start: 2024-01-01T00:00:00+01:00
        consumption: { constant_cost: 95.0 }

modules:
  - type: tariff
    name: dynamic
    source:
      type: energy_cost
      tariff: { type: resource, name: dynamic }
      cost_group: consumption
```
