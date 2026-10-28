---
title: Using it from Python
description: Calculate a bill with energy-cost in your own code.
sidebar:
  order: 6
---

```sh
pip install energy-cost
```

energy-cost needs Python 3.11 or newer.

## Calculating a bill

```python
import pandas as pd
from energy_cost import Contract, Meter, PowerDirection, TimeseriesFrame

contract = Contract.from_yaml("contract.yml")

timestamps = pd.date_range("2025-01-01", "2025-04-01", freq="15min", inclusive="left", tz="Europe/Brussels")
consumption = Meter(measurements=TimeseriesFrame({"timestamp": timestamps, "value": 0.00025}))
injection = Meter(
    direction=PowerDirection.INJECTION,
    measurements=TimeseriesFrame({"timestamp": timestamps, "value": 0.0001}),
)

bill = contract.apply(consumption, injection=injection)
print(bill[("total", "total", "total")])
```

For a [contract history](/docs/energy-cost/contracts/#a-contract-that-changes), use `ContractHistory.from_yaml` instead; it works the same way.

## Meters

A `Meter` holds the measurements of one direction:

| Field | What it is |
| --- | --- |
| `direction` | `PowerDirection.CONSUMPTION`, the default, or `PowerDirection.INJECTION` |
| `type` | `MeterType.SINGLE_RATE`, the default, or `MeterType.NIGHT_ONLY` |
| `measurements` | A `TimeseriesFrame` with a `timestamp`, the start of each interval, and a `value`, the energy in MWh during it |
| `capacity` | Optional: the peaks, in MW, if you have them; otherwise they are worked out from the measurements |

`TimeseriesFrame` is a pandas DataFrame that also knows its resolution: from the first two timestamps, or given as `TimeseriesFrame(..., resolution=...)`.

- Measurements must cover every interval of the bill. A gap, or a missing value, makes that period's total empty.
- For Flemish electricity, measurements must be per quarter-hour or finer, for the [capacity tariff](/docs/energy-cost/taxes-and-capacity/#capacity).

## The bill

`apply` takes these options:

| Option | What it is |
| --- | --- |
| `injection` | The injection meter, if any |
| `start`, `end` | The period to bill. That of the measurements if left out. |
| `output_resolution` | The period of each row: a `datetime.timedelta`, or an `isodate.Duration` for months and years. A month if left out. |

The result is a pandas DataFrame with one row per period. Its `timestamp` column holds each period's start, in the contract's time zone. The other columns have three levels: the part of the bill, the [cost group](/docs/energy-cost/tariffs/#cost-groups) and the [cost type](/docs/energy-cost/tariffs/#cost-types). Each level has a `total`:

| Column | What it is |
| --- | --- |
| `("supplier", "consumption", "energy")` | One cost |
| `("supplier", "consumption", "total")` | A cost group |
| `("supplier", "total", "total")` | A part of the bill |
| `("taxes", "total", "total")` | All taxes |
| `("total", "total", "total")` | The whole bill, taxes included |

## Indexes

A tariff that [follows an index](/docs/energy-cost/tariffs/#price-per-mwh) needs that index registered under its name before the tariff is read. For the Belgian day-ahead price from ENTSO-E:

```python
from energy_cost.index import CachedIndex, EntsoeDayAheadIndex, Index

Index.register("belpex", CachedIndex(EntsoeDayAheadIndex("BE", api_key="YOUR_ENTSOE_KEY"), file_name="belpex"))
```

`CachedIndex` keeps fetched prices on disk, under `~/.cache/energy_cost`. Your own prices work too, in €/MWh, with `timestamp` and `value` columns: `CSVIndex("prices.csv")` or `DataFrameIndex(df)`.

## Suppliers

To refer to a supplier's product with `supplier_key` and `product_key` in a contract, register it first:

```python
from energy_cost import Supplier, Tariff

Supplier.register("my_supplier", Supplier(products={"fixed": Tariff.from_yaml("fixed.yml")}))
```

## Separate sets of names

Indexes and suppliers are registered in the active `Catalog`. To keep separate sets, for example per customer, create a `Catalog` and use it within `with catalog.active():`.

## Prices of a tariff

`Tariff.get_values` gives the prices of a tariff over time, in €/MWh, such as for a price chart:

```python
from datetime import datetime, timedelta, timezone
from energy_cost import CostGroup, Tariff

tariff = Tariff.from_yaml("tariff.yml")
prices = tariff.get_values(
    datetime(2025, 1, 1, tzinfo=timezone.utc),
    datetime(2025, 1, 2, tzinfo=timezone.utc),
    timedelta(minutes=15),
    cost_group=CostGroup.CONSUMPTION,
)
```

This is what Cofy's [`energy_cost` source](/docs/sources/energy-cost/) serves.
