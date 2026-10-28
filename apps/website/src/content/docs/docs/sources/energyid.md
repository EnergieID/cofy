---
title: EnergyID production
description: The production of a meter, from an EnergyID record.
sidebar:
  label: EnergyID
  order: 3
---

The `energyid_production` source provides the energy produced by a meter, from an [EnergyID](https://www.energyid.eu/) record.

Install: `pip install "cofy-api[production,energyid]"`

Fits: [`production`](/docs/modules/production/), [`directive`](/docs/modules/directive/) and [`timeseries`](/docs/modules/timeseries/).

## Settings

| Field | What it is |
| --- | --- |
| `api_key` | A [secret](/docs/sources/#credentials-secrets) holding an EnergyID API key with access to the record. Required. |
| `record_id` | The EnergyID record. Required. |
| `cache` | How to [cache](/docs/sources/#caching) the data. Optional; give it a `max_age`. |

## What you get

- Production in the unit EnergyID keeps it in, normally kWh.
- Resolutions `PT5M`, `PT15M`, `PT1H`, `P1D`, `P7D`, `P1M` and `P1Y`. Without a `resolution`, you get 5 minutes.
- Data is requested from EnergyID per day, so ask for whole days.

## Example

```yaml
type: energyid_production
api_key: { type: secret, name: energyid_key }
record_id: your-record-id
cache: { max_age: PT15M }
```
