---
title: Concepts
description: The handful of ideas everything else in Cofy builds on.
---

A few words come back everywhere in Cofy. This page explains them once, so the rest of the docs can use them.

## Community

A **community** is one energy community, or one supplier's setup. Each community gets its own **Cofy API**: a web API that serves only that community's data.

## Module

A **module** is one thing a community's API can do. You switch on only the modules you need:

| Module | What it does |
| --- | --- |
| `members` | The community's members |
| `production` | Local energy production, as time series |
| `tariff` | Energy prices, as time series |
| `billing` | Calculates energy costs from meter data and a contract |
| `simultaneity` | How much consumption overlaps with local production, as time series |
| `directive` | A five-step signal, from `--` to `++`, telling members when to use energy |

## Source

A **source** is where a module gets its data from, such as EnergyID meter data, ENTSO-E day-ahead prices, or Elia and NED solar forecasts. Each module only accepts sources that fit it: a tariff module only takes prices, for example.

## Format

A **format** is the shape a module serves its data in. Most modules can offer the same data in more than one format.

## Resource

A **resource** is something configured once and used in several places, such as a source that several modules share. A shared source is fetched once, so every module using it shares its cache.

## Secret

A **secret** is a credential, such as an API key. It is stored once per community and referenced by name. The management API never sends a secret's value back.
