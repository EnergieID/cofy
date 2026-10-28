---
title: Taxes and capacity
description: VAT rates on each part of the bill, and how the peak for a capacity tariff is found.
sidebar:
  order: 3
---

Both are filled in from the [built-in data](/docs/energy-cost/built-in-data/) of a region, so you only write them for a region energy-cost doesn't know, or to change them.

## Taxes

`taxes` is a list of versions, like a [tariff](/docs/energy-cost/tariffs/#versions). Unlike a tariff version, a tax version may have an `end`.

| Field | What it is |
| --- | --- |
| `start` | When the rates start. Required. |
| `end` | When they stop. Optional. |
| `default` | The rate for everything no other rate covers, as a fraction: 6% is `0.06` |
| `rates` | Other rates, each a `rate` and the `columns` of the bill it applies to |

A column is three parts: the part of the bill (`supplier`, `distributor`, `fees`), the [cost group](/docs/energy-cost/tariffs/#cost-groups) and the [cost type](/docs/energy-cost/tariffs/#cost-types). `*` stands for any. The built-in Belgian electricity taxes:

```yaml
taxes:
  - start: 2022-01-01T00:00:00+01:00
    default: 0.06
    rates:
      - rate: 0.0
        columns:
          - [fees, fixed, energy_fund]
          - ["*", injection, "*"]
```

That's 6% on everything, except nothing on the energy fund and on anything paid or received for injection. When several columns match a cost, the most specific one wins, with the cost type counting most.

The bill shows taxes as a single total.

## Capacity

Some distributors charge for the highest power a connection draws, its **peak**, instead of only for the energy. A `capacity_rule` says how that peak is measured:

| Field | What it is |
| --- | --- |
| `measurement_period` | The period power is averaged over, such as `PT15M` |
| `billing_period` | The period whose highest value is the peak, such as `P1M` |
| `window_periods` | Optional: average the peak over this many billing periods, the current one included |

The built-in Flemish rule is the Flemish capacity tariff: the average power per quarter-hour, the highest of each month, averaged over the last twelve months.

```yaml
capacity_rule:
  measurement_period: PT15M
  billing_period: P1M
  window_periods: 12
```

Formulas marked [`capacity_based`](/docs/energy-cost/tariffs/#capacity-prices) are charged on this peak. Meter data must be at least as fine as the `measurement_period`, so for Flanders every quarter-hour. For a full twelve-month average, pass a year of earlier data and set the bill's start to the period you want billed.

If you already have the peaks, for example from a meter that measures them, you can give them to the meter directly and the rule's averaging is skipped.
