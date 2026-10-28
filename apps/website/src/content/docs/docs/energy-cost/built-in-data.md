---
title: Built-in data
description: The regions, distributors, fees and taxes energy-cost knows.
sidebar:
  order: 4
---

For a region it knows, energy-cost fills in a [contract](/docs/energy-cost/contracts/#how-built-in-data-is-filled-in): the distributor's tariff, the fees, the taxes, the capacity rule and the time zone. For now that's Flanders, for residential and small business connections with a digital meter.

## Flanders: `be_flanders`

Time zone `Europe/Brussels`.

### Distributors

The Fluvius grid areas, for both electricity and gas:

| `distributor_key` | Data from |
| --- | --- |
| `fluvius_antwerpen` | 2024 |
| `fluvius_imewo` | 2024 |
| `fluvius_limburg` | 2024 |
| `fluvius_west` | 2024 |
| `fluvius_halle_vilvoorde` | 2025 |
| `fluvius_kempen` | 2025 |
| `fluvius_midden_vlaanderen` | 2025 |
| `fluvius_zenne_dijle` | 2025 |

Their tariffs come from the VREG, for low voltage.

- **Electricity:** transmission, levies and a public service fee per MWh, a yearly data management fee, and the capacity tariff on the monthly peak, with its yearly minimum.
- **Gas:** Fluvius's distribution fees and levies, in bands by yearly use, plus Fluxys's transport.

### Electricity

| `customer_type` | Fees |
| --- | --- |
| `residential` | Federal excise and energy contribution, and in 2022 the Flemish energy fund |
| `non_residential` | Federal excise and energy contribution, and the Flemish energy fund |
| `protected` | Federal excise and energy contribution, as for protected customers |

- **Taxes:** 6% VAT, none on the energy fund or on injection.
- **Capacity rule:** the Flemish capacity tariff, see [capacity](/docs/energy-cost/taxes-and-capacity/#capacity). Meter data must be per quarter-hour or finer.

### Gas

- **Fees:** federal excise and energy contribution.
- **Taxes:** 6% VAT.
- No capacity rule.

## Coverage

Fees and taxes start in 2022; distributor tariffs in 2024 or 2025, as above.

- **Before** a tariff's first version, it has no price: a bill over that time is incomplete, or leaves that part out.
- **After** its last version, the last prices keep applying. Keep energy-cost up to date for new years' tariffs.

## Adding a region

The [energy-cost repository](https://github.com/EnergieID/energy-cost) explains how built-in data is organised, and how to contribute the data for a region it doesn't know yet. Until then, write the distributor, fees, taxes and time zone into the contract yourself.
