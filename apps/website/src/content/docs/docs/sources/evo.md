---
title: EvO connection forecast
description: The forecast net volume of a connection, from Energie van Ons.
sidebar:
  label: EvO
  order: 4
---

The `acc_forecast` source provides the forecast net volume of one connection, from [Energie van Ons](https://energie.vanons.org/) (EvO): kWh per quarter-hour, positive for what the connection takes from the grid and negative for what it puts on it.

Install: `pip install "cofy-api[acc]"`

Fits: the [`simultaneity` source](/docs/modules/simultaneity/#the-simultaneity-source), [`directive`](/docs/modules/directive/) and [`timeseries`](/docs/modules/timeseries/).

## Settings

| Field | What it is |
| --- | --- |
| `ean` | The connection's 18-digit EAN. Required. |
| `credentials` | A [secret](/docs/sources/#credentials-secrets) holding the service account key, in JSON, that EvO provided. Put the JSON on a single line. Required. |
| `cache` | How to [cache](/docs/sources/#caching) the forecast. Optional; give it a `max_age`. |

## What you get

- kWh per quarter-hour, `PT15M`, the only resolution.

## Example

Simultaneity across two connections:

```yaml
type: simultaneity
sources:
  - type: acc_forecast
    ean: "541234567890123456"
    credentials: { type: secret, name: evo_credentials }
    cache: { max_age: PT15M }
  - type: acc_forecast
    ean: "541234567890123457"
    credentials: { type: secret, name: evo_credentials }
    cache: { max_age: PT15M }
```
