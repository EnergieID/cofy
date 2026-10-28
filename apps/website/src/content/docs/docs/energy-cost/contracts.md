---
title: Contracts
description: Every part of an energy-cost contract, and how built-in data fills it in.
sidebar:
  order: 1
---

A contract describes everything that makes up one connection's bill. In YAML it is a single mapping.

## Fields

| Field | What it is |
| --- | --- |
| `region` | The region whose [built-in data](/docs/energy-cost/built-in-data/) to use, such as `be_flanders` |
| `connection_type` | `electricity` or `gas`. Needed for any built-in data. |
| `customer_type` | `residential`, `non_residential` or `protected`. Picks the region's fees. |
| `distributor_key` | The grid operator within the region, such as `fluvius_imewo`. Picks the distributor's tariff. |
| `supplier` | The supplier's [tariff](/docs/energy-cost/tariffs/) |
| `supplier_key`, `product_key` | Instead of `supplier`: a supplier and product registered [in Python](/docs/energy-cost/python/#suppliers) |
| `distributor` | A [tariff](/docs/energy-cost/tariffs/) replacing the region's distributor tariff |
| `fees` | A [tariff](/docs/energy-cost/tariffs/), or a list of tariffs, replacing the region's fees |
| `taxes` | [Taxes](/docs/energy-cost/taxes-and-capacity/#taxes) replacing the region's |
| `capacity_rule` | A [capacity rule](/docs/energy-cost/taxes-and-capacity/#capacity) replacing the region's |
| `timezone` | A time zone name such as `Europe/Brussels`. The region's if it has one, otherwise `UTC`. |
| `start`, `end` | When the contract applies, in a [contract history](#a-contract-that-changes) |

Every field is optional, but a bill needs at least one tariff.

## How built-in data is filled in

With a `region` and a `connection_type`, energy-cost fills in what you leave out:

- the **time zone**, from the region;
- the **taxes** and the **capacity rule**, from the region;
- the **fees**, from the region, if you give a `customer_type`;
- the **distributor** tariff, from the region, if you give a `distributor_key`.

Anything you write yourself replaces the built-in part as a whole: a `fees` tariff replaces all of the region's fees, it isn't added to them. Without a `customer_type` there are no fees, and without a `distributor_key` there is no distributor cost.

:::caution
energy-cost ignores fields it doesn't know. A misspelling such as `supplierr:` gives no error, just a bill without that part. If a part of the bill is missing, check the spelling first.
:::

## Several tariffs in one part

`supplier`, `distributor` and `fees` can also be a list of tariffs, whose costs are added up. That's how the built-in data for Flanders combines the Flemish fees with the federal ones. Each tariff in the list is itself a list of versions, so the list has two levels:

```yaml
fees:
  - - start: 2025-01-01T00:00:00+01:00
      fixed:
        regional_fund: { period: P1M, constant_cost: 1.5 }
  - - start: 2025-01-01T00:00:00+01:00
      consumption:
        national_levy: { constant_cost: 2.0 }
```

## A contract that changes

A **contract history** is a list of contracts, each with a `start` and, optionally, an `end`. Each one applies from its `start` until its `end`, or until the next one starts:

```yaml
- start: 2025-01-01T00:00:00+01:00
  end: 2025-07-01T00:00:00+02:00
  region: be_flanders
  connection_type: electricity
  customer_type: residential
  distributor_key: fluvius_imewo
  supplier:
    - start: 2025-01-01T00:00:00+01:00
      consumption: { constant_cost: 110.0 }
- start: 2025-07-01T00:00:00+02:00
  region: be_flanders
  connection_type: electricity
  customer_type: residential
  distributor_key: fluvius_imewo
  supplier:
    - start: 2025-07-01T00:00:00+02:00
      consumption: { constant_cost: 95.0 }
```

A period that no contract covers is left out of the bill. A single contract, not in a list, ignores its `start` and `end`.

Use a contract history for a change of supplier, address or customer type. For a price change with the same supplier, add a [version](/docs/energy-cost/tariffs/#versions) to the tariff instead.

## Dates and times

Write dates and times in ISO 8601 with their offset: `2025-01-01T00:00:00+01:00`. A date or time without an offset is read in the contract's time zone. Around the change to winter time, a time that occurs twice is taken as the second, in winter time; a time skipped by the change to summer time moves forward.
