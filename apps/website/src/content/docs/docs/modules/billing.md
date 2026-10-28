---
title: Billing
description: Calculate energy costs from meter data and a contract.
sidebar:
  order: 6
---

The `billing` module calculates what a connection's energy costs, from its meter data and its contract, with [energy-cost](/docs/energy-cost/). Both are sent with each request, so the module itself has nothing to configure.

Install: `pip install "cofy-api[billing]"`

## Settings

Only the [settings every module has](/docs/modules/#settings-every-module-has):

```yaml
type: billing
```

## Calculating a bill

`POST /billing/{name}/v2`, with a body like this:

```json
{
  "start": "2025-01-01T00:00:00+01:00",
  "end": "2025-02-01T00:00:00+01:00",
  "resolution": "P1M",
  "consumption": {
    "type": "single_rate",
    "measurements": {
      "resolution": "PT15M",
      "values": [
        { "timestamp": "2025-01-01T00:00:00+01:00", "value": 0.25 },
        { "timestamp": "2025-01-01T00:15:00+01:00", "value": 0.31 }
      ]
    }
  },
  "contract": {
    "region": "be_flanders",
    "connection_type": "electricity",
    "customer_type": "residential",
    "distributor_key": "fluvius_imewo",
    "supplier": [{ "start": "2025-01-01T00:00:00+01:00", "consumption": { "constant_cost": 90.0 } }]
  }
}
```

| Field | What it is |
| --- | --- |
| `start`, `end` | The period to bill. That of the measurements if left out. |
| `resolution` | The period of each row of the bill: `P1M` if left out, or `P1D`, `P1Y`. |
| `consumption` | The consumption meter. Required. |
| `injection` | The injection meter, if any, in the same shape |
| `contract` | A [contract](/docs/energy-cost/contracts/), or a list of them for a [contract that changes](/docs/energy-cost/contracts/#a-contract-that-changes), written as JSON |

A meter has:

| Field | What it is |
| --- | --- |
| `type` | `single_rate`, the default, or `night_only` |
| `measurements` | The `values`, each a `timestamp` and the energy in **kWh** in the interval starting then, and their `resolution` |
| `capacity` | Optional: the peaks, in **W**, in the same shape, if you have them |

:::caution
Always give the `resolution` of the measurements, such as `PT15M`: it is `P1M` if left out. For Flemish electricity, measurements must be per quarter-hour or finer, for the [capacity tariff](/docs/energy-cost/taxes-and-capacity/#capacity).
:::

The billing module takes kWh and W, while energy-cost itself works in MWh and MW: the module converts them. Prices in the contract stay in €/MWh.

Measurements must cover the whole period: a period with a missing value gets no total.

## The answer

For January 2025, with 0.25 kWh every quarter-hour:

```json
{
  "metadata": { "start": "2025-01-01T00:00:00+01:00", "end": "2025-02-01T00:00:00+01:00", "resolution": "P1M" },
  "data": [
    {
      "timestamp": "2025-01-01T00:00:00+01:00",
      "supplier": {
        "consumption": { "total": 66.96 },
        "total": { "total": 66.96 }
      },
      "distributor": {
        "capacity": { "total": 11.304858817123286 },
        "consumption": {
          "levies": 1.3409856,
          "public_service_fee": 24.1724856,
          "transmission": 18.3104352,
          "total": 43.8239064
        },
        "fixed": { "data_management": 1.487150684931507, "total": 1.487150684931507 },
        "total": { "total": 56.615915902054795 }
      },
      "fees": {
        "consumption": { "energy_contribution": 1.4330184, "excise": 35.32512, "total": 36.7581384 },
        "total": { "total": 36.7581384 }
      },
      "taxes": { "total": { "total": 9.620043258123287 } },
      "total": { "total": { "total": 169.95409756017807 } }
    }
  ]
}
```

Each part of the bill is broken down by [cost group](/docs/energy-cost/tariffs/#cost-groups) and [cost type](/docs/energy-cost/tariffs/#cost-types), in €, with a `total` at each level. Amounts aren't rounded, and each row's `timestamp` is the start of its period, in the contract's time zone. A part that doesn't apply is left out. An invalid contract or meter gives a 400 with the reason.

## Contracts from the members module

The [members module](/docs/modules/members/) serves each member's contract history in this same contract form, so an app can fetch a contract there and send it here.
