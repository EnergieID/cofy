---
title: Modules
description: What each module does, and what every module has in common.
sidebar:
  label: Overview
  order: 0
---

A [module](/docs/concepts/#module) is one thing a community's API can do. A community switches on only the modules it needs, and can switch on the same module more than once, for example a tariff for consumption and another for injection.

| Module | What it does | Takes a source |
| --- | --- | --- |
| [`members`](/docs/modules/members/) | Lists the community's members, verifies their activation codes and serves their contracts | Yes, a member source |
| [`tariff`](/docs/modules/tariff/) | Serves energy prices as a time series | Yes, a price source |
| [`production`](/docs/modules/production/) | Serves energy production as a time series | Yes, a production source |
| [`simultaneity`](/docs/modules/simultaneity/) | Serves how much production is consumed at the same time | Yes, a ratio source |
| [`directive`](/docs/modules/directive/) | Serves a five-step signal, from `--` to `++`, telling members when to use energy | Yes, a directive source |
| [`billing`](/docs/modules/billing/) | Calculates energy costs from meter data and a contract | No |
| [`timeseries`](/docs/modules/timeseries/) | Serves any time series, such as a solar forecast | Yes, any time series source |

## Settings every module has

| Field | What it is |
| --- | --- |
| `type` | The module, such as `tariff` |
| `name` | Lowercase letters, digits, `-` and `_`; `default` if left out. It is part of the module's address, so it must be unique among modules of the same type. |
| `display_name` | A name for people; the `name` if left out |
| `description` | What this module is for; the module's own description if left out |

In the console, these are the fields at the top of a module's form. The examples in these docs each show one module, ready to paste into the console's [YAML view](/docs/console/modules/):

```yaml
type: tariff
name: entsoe
display_name: Day-ahead prices
source:
  type: entsoe_day_ahead
  country_code: BE
  api_key: { type: secret, name: entsoe_key }
```

In a [settings file](/docs/self-host/settings-file/), each module is an entry of the `modules` list:

```yaml
modules:
  - type: tariff
    name: entsoe
    # …
```

## Where a module is served

Each module is served at `/{type}/{name}/{version}`, for example `/tariff/entsoe/v1`. The version is `v1` for every module except billing, which is at `v2`.

Every COFY API also serves interactive API documentation at `/docs`, its OpenAPI description at `/openapi.json`, and a health check at `/health`.

## Time series modules

The `tariff`, `production`, `simultaneity`, `directive` and `timeseries` modules all serve a time series. How to ask them for a period, the formats they serve and how they cache are described once, on the [time series](/docs/modules/timeseries/) page.
