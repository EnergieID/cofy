---
title: Energy cost
description: Model a complete energy bill, on its own or inside Cofy.
sidebar:
  label: Overview
---

[energy-cost](https://github.com/EnergieID/energy-cost) is an open-source Python library that models a complete energy bill from energy consumption. It's what Cofy's billing module uses, and it also works on its own.

A bill is calculated from a **contract**, made of:

- the **supplier**'s tariff
- the **distributor**'s tariff
- the government **fees**
- the **taxes** on each part of the bill
- the **timezone** all calculations run in

Give a contract a region, connection type, customer type and distributor, and the library fills in the distributor tariffs, fees, taxes and timezone from its built-in data.

## On its own

```sh
pip install energy-cost
```

A contract can be written in YAML:

```yaml
supplier:
- start: 2025-01-01T00:00:00+01:00
  consumption:
    constant_cost: 90.0
region: be_flanders
connection_type: electricity
customer_type: residential
distributor_key: fluvius_imewo
```

The [energy-cost repository](https://github.com/EnergieID/energy-cost) has notebooks for every part of a contract, and explains how to add the data for a region that isn't supported yet.

## Inside Cofy

Switch on the `billing` module in a community to calculate costs through its Cofy API. To use tariffs from energy-cost as a source in other modules, install the `energy-cost` extra:

```sh
pip install "cofy-api[billing,energy-cost]"
```
