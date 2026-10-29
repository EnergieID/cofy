---
title: Energy cost
description: Model a complete energy bill, on its own or inside COFY.
sidebar:
  label: Overview
  order: 0
---

[energy-cost](https://github.com/EnergieID/energy-cost) is an open-source Python library that calculates a complete energy bill from metered consumption and injection. It's what COFY's [billing module](/docs/modules/billing/) and [`energy_cost` source](/docs/sources/energy-cost/) use, and it also works on its own.

A bill is calculated from a **contract**, which brings together:

| Part | What it is |
| --- | --- |
| **supplier** | The energy supplier's tariff |
| **distributor** | The grid operator's tariff |
| **fees** | Government fees and levies, such as excise |
| **taxes** | VAT on each part of the bill |
| **timezone** | The time zone all dates and times are read in |

You rarely write all of it. Give a contract a region, connection type, customer type and distributor, and energy-cost fills in the distributor's tariff, the fees, the taxes and the time zone from its [built-in data](/docs/energy-cost/built-in-data/). Then you only write the supplier's tariff:

```yaml
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_imewo
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy: { constant_cost: 95.0 }
```

## Where to go next

- [Contracts](/docs/energy-cost/contracts/): every part of a contract, and how built-in data is filled in.
- [Tariffs](/docs/energy-cost/tariffs/): how to write a tariff, from a fixed price to time-of-use, tiers and dynamic prices.
- [Taxes and capacity](/docs/energy-cost/taxes-and-capacity/): VAT rates and capacity tariffs.
- [Built-in data](/docs/energy-cost/built-in-data/): the regions, distributors, fees and taxes energy-cost knows.
- [Examples](/docs/energy-cost/examples/): complete contracts to start from.
- [Using it from Python](/docs/energy-cost/python/): calculate a bill in your own code.

## Units

energy-cost works in euro, MWh and MW:

| Quantity | Unit |
| --- | --- |
| Energy prices | €/MWh. 1 c/kWh is 10 €/MWh, so 9.5 c/kWh is `95.0`. |
| Fixed costs | € per period, such as € per year |
| Capacity prices | € per MW |
| Tax rates | A fraction: 6% is `0.06` |
| The bill | € |

**A positive cost is paid by the customer; a negative cost is received.** That holds for injection too: a price you pay for the energy you inject is positive, and a price you receive for it is negative.

## Inside COFY

- The [billing module](/docs/modules/billing/) calculates a bill from meter data and a contract sent with each request.
- The [`energy_cost` source](/docs/sources/energy-cost/) serves the prices of a tariff through the [tariff module](/docs/modules/tariff/), for example your own dynamic tariff.
