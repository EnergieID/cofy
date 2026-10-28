---
title: ENTSO-E day-ahead prices
description: Day-ahead electricity prices of a European bidding zone.
sidebar:
  label: ENTSO-E
  order: 1
---

The `entsoe_day_ahead` source provides the day-ahead electricity price of a bidding zone, in EUR/MWh, from the [ENTSO-E Transparency Platform](https://transparency.entsoe.eu/).

Install: `pip install "cofy-api[tariff,entsoe]"`

Fits: [`tariff`](/docs/modules/tariff/), [`directive`](/docs/modules/directive/) and [`timeseries`](/docs/modules/timeseries/).

## Settings

| Field | What it is |
| --- | --- |
| `api_key` | A [secret](/docs/sources/#credentials-secrets) holding your ENTSO-E API key. Required. |
| `country_code` | The bidding zone, such as `BE` or `NL`. If left out, each request picks one with a `country_code` parameter, `BE` by default. |
| `cache` | How to [cache](/docs/sources/#caching) prices. Optional. |

You get an API key by registering on the Transparency Platform and asking ENTSO-E for API access.

## What you get

- Prices in steps of 15 minutes, `PT15M`, the only resolution. Older hourly prices are repeated for each quarter-hour.
- Prices stay valid for an hour, so `cache: {}` works.
- A period without prices yet, such as tomorrow before the auction, gives an empty series.

## Example

```yaml
type: entsoe_day_ahead
country_code: BE
api_key: { type: secret, name: entsoe_key }
cache: {}
```
