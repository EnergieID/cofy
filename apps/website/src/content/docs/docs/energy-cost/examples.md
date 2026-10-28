---
title: Examples
description: Complete energy-cost contracts to start from.
sidebar:
  order: 5
---

Each example is a complete [contract](/docs/energy-cost/contracts/) for a residential electricity connection in Flanders. The distributor, fees and taxes come from the [built-in data](/docs/energy-cost/built-in-data/); only the supplier's tariff is written out.

## Fixed price, with solar panels

9.5 c/kWh for consumption, 3 c/kWh received for injection, and a subscription of 60 € a year:

```yaml
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_imewo
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy: { constant_cost: 95.0 }
    injection:
      energy: { constant_cost: -30.0 }
    fixed:
      subscription: { period: P1Y, constant_cost: 60.0 }
```

## Dynamic price

110% of the day-ahead price plus 1.2 c/kWh and 1.5 c/kWh for green certificates. For injection, 90% of the day-ahead price minus a fee of 0.5 c/kWh. And 4.50 € a month.

```yaml
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_west
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy:
        constant_cost: 12.0
        variable_costs:
          - { index: belpex, scalar: 1.1 }
      green_certificates: { constant_cost: 15.0 }
    injection:
      energy:
        constant_cost: 5.0
        variable_costs:
          - { index: belpex, scalar: -0.9 }
    fixed:
      subscription: { period: P1M, constant_cost: 4.5 }
```

The index `belpex` has to be [registered](/docs/energy-cost/python/#indexes) before this contract is read. For injection, the fee is positive, paid by the customer, and the day-ahead share negative, received.

## Peak and off-peak

15 c/kWh on weekdays from 7:00 to 22:00, 9 c/kWh at all other times:

```yaml
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_antwerpen
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy:
        schedule:
          - when:
              - days: [monday, tuesday, wednesday, thursday, friday]
                start: "07:00"
                end: "22:00"
            formula: { constant_cost: 150.0 }
          - formula: { constant_cost: 90.0 }
    injection:
      energy: { constant_cost: -25.0 }
```

## A price change

The price drops from 11 to 9.5 c/kWh on 1 July. A new version of the same tariff:

```yaml
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_imewo
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption: { constant_cost: 110.0 }
  - start: 2025-07-01T00:00:00+02:00
    consumption: { constant_cost: 95.0 }
```

For a change of supplier instead, use a [contract history](/docs/energy-cost/contracts/#a-contract-that-changes).

## Outside Flanders

Without built-in data, write every part yourself:

```yaml
timezone: Europe/Amsterdam
supplier:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy: { constant_cost: 100.0 }
distributor:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      transport: { constant_cost: 40.0 }
    fixed:
      connection: { period: P1Y, constant_cost: 250.0 }
fees:
  - start: 2025-01-01T00:00:00+01:00
    consumption:
      energy_tax: { constant_cost: 101.0 }
taxes:
  - start: 2025-01-01T00:00:00+01:00
    default: 0.21
```

The amounts are made up, to show the shape.
