---
title: Production
description: Serve local energy production as a time series.
sidebar:
  order: 3
---

The `production` module serves energy produced, in kWh, as a [time series](/docs/modules/timeseries/): what a community's wind turbine or solar panels produced.

Install: `pip install "cofy-api[production]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | Where the production comes from. Required. |
| `formats` | `json` and `csv`, the defaults. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

### Sources

| Source | Production |
| --- | --- |
| [`energyid_production`](/docs/sources/energyid/) | The production of a meter, from EnergyID |
| [`demo_production`](/docs/sources/demo/) | Generated solar production, to try things out |

A forecast of production, such as [Elia's](/docs/sources/elia/) or [NED's](/docs/sources/ned/), is served by the [`timeseries`](/docs/modules/timeseries/) module instead.

## Asking for production

`GET /production/{name}/v1`, with the [usual time series parameters](/docs/modules/timeseries/#asking-for-a-period). Without a `resolution`, you get the source's finest one: for EnergyID, steps of 5 minutes.

## Example

```yaml
type: production
name: wind
source:
  type: energyid_production
  api_key: { type: secret, name: energyid_key }
  record_id: your-record-id
```
