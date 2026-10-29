---
title: Tariff
description: Serve energy prices as a time series.
sidebar:
  order: 2
---

The `tariff` module serves energy prices, in EUR/MWh, as a [time series](/docs/modules/timeseries/). Use it for the day-ahead market price, or for your own tariff.

Install: `pip install "cofy-api[tariff]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | Where the prices come from. Required. |
| `formats` | The formats to offer: `json`, `csv` and `kiwatt`. JSON and CSV if left out. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

### Sources

| Source | Prices |
| --- | --- |
| [`entsoe_day_ahead`](/docs/sources/entsoe/) | The day-ahead market price of a bidding zone |
| [`energy_cost`](/docs/sources/energy-cost/) | Your own tariff, fixed or following an index |
| [`demo_price`](/docs/sources/demo/) | Generated prices, to try things out |

## Asking for prices

`GET /tariff/{name}/v1`, with the [usual time series parameters](/docs/modules/timeseries/#asking-for-a-period). Unlike the other modules, a tariff looks ahead: without parameters you get the next three days, from the current quarter-hour, in steps of 15 minutes.

## The Kiwatt format

The `kiwatt` format serves prices in the shape Kiwatt expects:

```json
{
  "generatedAtUTC": "…",
  "periodStartUTC": "…",
  "periodEndUTC": "…",
  "source": "COFY-API-Demo",
  "unit": "EUR/MWh",
  "resolution": "PT15M",
  "prices": [{ "startUTC": "…", "value": 92.4 }]
}
```

Its one setting, `source`, is the name written into the answer.

## Example

Belgian day-ahead prices in the Kiwatt format, at `/tariff/kiwatt/v1`:

```yaml
type: tariff
name: kiwatt
source:
  type: entsoe_day_ahead
  country_code: BE
  api_key: { type: secret, name: entsoe_key }
formats:
  - type: kiwatt
```

To serve the same prices in JSON from a second module, without fetching them twice, make the source a [shared resource](/docs/sources/#sharing-a-source).
