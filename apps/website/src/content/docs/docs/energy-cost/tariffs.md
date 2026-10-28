---
title: Tariffs
description: How to write an energy-cost tariff, from a fixed price to time-of-use, tiers and dynamic prices.
sidebar:
  order: 2
---

A tariff says what each part of the energy costs over time. The supplier, the distributor and the fees in a [contract](/docs/energy-cost/contracts/) are all tariffs, and so is the `tariff` of Cofy's [`energy_cost` source](/docs/sources/energy-cost/).

## Versions

A tariff is a list of **versions**. Each version starts at its `start` and runs until the next one starts; the last one runs on indefinitely. A price change is a new version:

```yaml
- start: 2025-01-01T00:00:00+01:00
  consumption: { constant_cost: 95.0 }
- start: 2025-07-01T00:00:00+02:00
  consumption: { constant_cost: 89.0 }
```

A version has no `end`; writing one is an error. Before the first version, the tariff has no price, so start your tariff no later than the meter data it's used with.

## Cost groups

Each version groups its costs by what they're charged on:

| Group | Charged on |
| --- | --- |
| `consumption` | The energy taken from the grid |
| `injection` | The energy put on the grid |
| `capacity` | The energy taken from the grid, or its peak with [`capacity_based`](#capacity-prices) |
| `fixed` | Nothing: costs that don't depend on use, such as a yearly fee |

The groups are labels for the bill: every group except `injection` is charged on the consumption meter, and a plain price per MWh under `capacity` is still per MWh. What makes a cost depend on the peak or on time is its [formula](#formulas).

## Cost types

Within a group, you can name each cost, and the bill shows each name separately:

```yaml
- start: 2025-01-01T00:00:00+01:00
  consumption:
    energy: { constant_cost: 95.0 }
    green_certificates: { constant_cost: 15.0 }
  fixed:
    subscription: { period: P1Y, constant_cost: 60.0 }
```

A group with a single formula and no names, such as `consumption: { constant_cost: 95.0 }`, is the same as naming it `total`. `total` is otherwise reserved: the bill adds it up for each group.

## Formulas

Each cost is a formula. energy-cost recognises the kind of formula from its fields:

| Formula | Recognised by | Use it for |
| --- | --- | --- |
| [Price](#price-per-mwh) | `constant_cost`, `variable_costs` | A price per MWh, fixed or following an index |
| [Periodic](#fixed-amounts) | `period` and `constant_cost` | A fixed amount per day, month or year |
| [Per unit per period](#capacity-prices) | `kind: unit_periodic` | A price per MW per year, for capacity |
| [Schedule](#time-of-use) | `schedule` | Different prices at different times |
| [Tiers](#tiers) | `bands` | Prices that change with the amount used |
| [Lowest or highest](#lowest-or-highest) | `minimum`, `maximum` | Whichever of several formulas costs least or most |
| [By meter type](#by-meter-type) | `by_meter_type` | Different prices for different meters |

Formulas nest: the formula inside a schedule, a tier or a lowest-or-highest can be any formula.

### Price per MWh

```yaml
energy: { constant_cost: 95.0 }
```

A price in €/MWh for each MWh. With `variable_costs`, the price follows one or more **indexes**, such as the day-ahead market price, each multiplied by a `scalar`:

```yaml
energy:
  constant_cost: 12.0
  variable_costs:
    - index: belpex
      scalar: 1.1
```

This is 12 €/MWh plus 110% of the `belpex` index at that moment. An index has to be known by name before the tariff is read. In Python you [register it yourself](/docs/energy-cost/python/#indexes); a Cofy API knows the indexes whoever runs it has registered.

### Fixed amounts

```yaml
subscription: { period: P1Y, constant_cost: 60.0 }
```

An amount in € per `period`, whatever is used. The period is an ISO 8601 duration: `P1D`, `P1M` or `P1Y`. The amount is spread evenly over the time it covers, so a yearly fee shows up as a share of it in each month.

### Time of use

A `schedule` is a list of entries, each a `formula` with the moments it applies to. At every moment the first matching entry applies, so end with an entry without `when` to cover all other times:

```yaml
energy:
  schedule:
    - when:
        - days: [monday, tuesday, wednesday, thursday, friday]
          start: "07:00"
          end: "22:00"
      formula: { constant_cost: 150.0 }
    - formula: { constant_cost: 90.0 }
```

Each `when` is a list of moments; an entry applies when any of them matches.

| Field | What it is |
| --- | --- |
| `days` | The days it applies, `monday` to `sunday`. Every day if left out. |
| `start` | From this time, included. Midnight if left out. |
| `end` | Until this time, not included. Midnight if left out. |

Times are local, in the contract's time zone. A moment can't cross midnight: for 22:00 to 07:00, write two moments, `start: "22:00"` and `end: "07:00"`.

:::caution
Always put times in quotes. YAML reads an unquoted `22:00` as a number of minutes, which silently becomes the wrong time.
:::

### Tiers

`bands` give a different price depending on how much is used in a `band_period`. Each band covers use up to `up_to` MWh, from low to high; leave `up_to` out of the last one:

```yaml
excise:
  band_period: P1Y
  bands:
    - up_to: 3
      formula: { constant_cost: 50.0 }
    - up_to: 20
      formula: { constant_cost: 45.0 }
    - formula: { constant_cost: 40.0 }
```

| Field | What it is |
| --- | --- |
| `bands` | The bands, each an `up_to` in MWh and a `formula`. Required. |
| `band_period` | The period use is counted over, such as `P1Y`. Each measurement on its own if left out. |
| `mode` | `progressive`, the default: each band's price applies to the use within that band, like tax brackets. `banded`: the band that the total use falls in prices all of it. |

When only part of a `band_period` is billed, its use is extrapolated to the whole period to find the band.

### Lowest or highest

```yaml
capacity:
  total:
    period: P1M
    minimum:
      - { constant_cost: 60.0 }
      - { capacity_based: true, kind: unit_periodic, period: P1Y, constant_cost: 50000.0 }
```

For each `period`, applies whichever formula in the list gives the lowest total cost; `maximum` takes the highest. If two cost the same, the first wins. The two can be combined, for a cost with a floor and a ceiling.

### By meter type

```yaml
energy:
  by_meter_type:
    night_only: { constant_cost: 70.0 }
    default: { constant_cost: 95.0 }
```

Picks a formula by the type of meter: `single_rate` or `night_only`, with `default` for any other.

### Capacity prices

Any formula can be charged on the peak instead of the energy, by adding `capacity_based: true`. It is then applied to the highest power, in MW, per billing period of the contract's [capacity rule](/docs/energy-cost/taxes-and-capacity/#capacity). A capacity price is usually € per MW per year, which is the `unit_periodic` formula; it needs its `kind` written out:

```yaml
capacity:
  total:
    capacity_based: true
    kind: unit_periodic
    period: P1Y
    constant_cost: 50000.0
```

That's 50 € per kW per year, charged each billing period of the capacity rule on that period's peak; in Flanders, per month. Without `kind: unit_periodic`, this would be read as a fixed amount per year.

## Writing a formula's kind

energy-cost recognises a formula from its fields. If a formula has fields of more than one kind, it checks `bands` first, then `minimum`, `maximum`, `by_meter_type`, `period`, `schedule`, and finally `constant_cost` and `variable_costs`. To be explicit, add `kind`: `index`, `periodic`, `unit_periodic`, `scheduled`, `tiered`, `minimum`, `maximum` or `meter_type`.
