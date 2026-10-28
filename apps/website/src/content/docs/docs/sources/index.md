---
title: Sources
description: Where modules get their data from, and how to configure, share and cache a source.
sidebar:
  label: Overview
  order: 0
---

A [source](/docs/concepts/#source) is where a module gets its data from. Each source provides one kind of data, and each module only takes sources of the kind it serves.

## Which source fits which module

| Source | Data | Fits | Install |
| --- | --- | --- | --- |
| [`entsoe_day_ahead`](/docs/sources/entsoe/) | Day-ahead electricity prices | `tariff`, `directive` | `entsoe` |
| [`energy_cost`](/docs/sources/energy-cost/) | Prices from your own tariff | `tariff`, `directive` | `energy-cost` |
| [`energyid_production`](/docs/sources/energyid/) | Production of a meter | `production`, `directive` | `energyid` |
| [`acc_forecast`](/docs/sources/evo/) | Forecast net volume of a connection, from EvO | `simultaneity` source, `directive` | `acc` |
| [`elia_solar_forecast`](/docs/sources/elia/) | Solar forecast of a Belgian region | `timeseries`, `directive` | `elia` |
| [`ned_production_forecast`](/docs/sources/ned/) | Production forecast of Dutch installations | `timeseries`, `directive` | `ned` |
| [`simultaneity`](/docs/modules/simultaneity/#the-simultaneity-source) | Simultaneity, from net volumes | `simultaneity`, `directive` | `simultaneity` |
| [`directive`](/docs/modules/directive/#fixed-boundaries-the-directive-source), [`dynamic_boundary_directive`](/docs/modules/directive/#boundaries-that-change-the-dynamic_boundary_directive-source) | Directive steps | `directive` | `directive` |
| [`demo_*`](/docs/sources/demo/) | Generated data of every kind | every module | `demo` |

"Install" is the extra to add: `pip install "cofy-api[tariff,entsoe]"`, for example. Every source also fits the [`timeseries`](/docs/modules/timeseries/) module, which serves any series as it is.

## Credentials: secrets

A source that needs an API key or other credential takes a [secret](/docs/concepts/#secret), referenced by name:

```yaml
api_key: { type: secret, name: entsoe_key }
```

In the console, store the key in the community's Secrets tab and pick it by name. In a settings file, list it under `secrets`:

```yaml
secrets:
  - name: entsoe_key
    description: Our ENTSO-E Transparency Platform key.
    value: your-key
```

## Sharing a source

A source configured once as a [resource](/docs/concepts/#resource) can be used by several modules. It is fetched once, so they share one cache:

```yaml
resources:
  - type: source
    name: entsoe_be
    value:
      type: entsoe_day_ahead
      country_code: BE
      api_key: { type: secret, name: entsoe_key }
      cache: {}

modules:
  - type: tariff
    name: entsoe
    source: { type: resource, name: entsoe_be }
  - type: directive
    name: prices
    source:
      type: directive
      source: { type: resource, name: entsoe_be }
      boundaries: [0, 10, 25, 50]
      reverse: true
```

## Caching

Without a `cache`, a source fetches its data again for every request. Give it a `cache` to keep what it fetched in memory:

| Field | What it is |
| --- | --- |
| `max_age` | How long fetched data stays valid, as an ISO 8601 duration such as `PT15M`. The source's own if left out. |
| `chunk_size` | The blocks of time fetched and kept together. A day, `P1D`, if left out. |
| `max_chunks` | How many blocks to keep, dropping the least recently used first. 1024 if left out. |

`cache: {}` uses all defaults. That only works for sources that say how long their data stays valid, such as ENTSO-E, Elia and NED; each source page says so. For the others, give a `max_age`.

If fetching fresh data fails while older data is still in the cache, the older data is served rather than an error.
