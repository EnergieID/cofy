---
title: Members
description: List a community's members, verify their activation codes and serve their contracts.
sidebar:
  order: 1
---

The `members` module serves a community's members: who they are, their addresses and the energy contracts at each address. An app can use it to let a member sign in with an activation code.

Install: `pip install "cofy-api[members]"`, plus the extra of the source you use.

## Settings

| Field | What it is |
| --- | --- |
| `source` | Where the members come from. Required. |

And the [settings every module has](/docs/modules/#settings-every-module-has).

For now the only member source you can configure is [`demo_members`](/docs/sources/demo/), with example members.

## Endpoints

| Endpoint | What it does |
| --- | --- |
| `GET /members/{name}/v1/` | Lists all members |
| `GET /members/{name}/v1/{member_id}` | One member, or 404 |
| `POST /members/{name}/v1/verify` | Finds the member with the `activation_code` in the body, or 404 |
| `GET /members/{name}/v1/{member_id}/contracts/{ean}` | The contract history of one connection, in [energy-cost](/docs/energy-cost/) form, ready for the [billing module](/docs/modules/billing/) |

The contracts endpoint takes an optional `meter_type`, `day_night_07` or `day_night_06`, for connections with a day and night meter.

## A member

```json
{
  "id": "M001",
  "activation_code": "…",
  "addresses": [
    {
      "contracts": [
        {
          "ean": "541234567890123456",
          "customer_type": "residential",
          "connection_type": "electricity",
          "supplier": { "name": "…", "id": "…" },
          "product": { "name": "…", "id": "…" },
          "distributor": { "name": "…", "id": "…" },
          "region": { "name": "…", "id": "…" },
          "start_date": "2024-01-01",
          "end_date": null,
          "last_invoice_date": null,
          "is_green": true
        }
      ]
    }
  ]
}
```

| Field | What it is |
| --- | --- |
| `customer_type` | `residential`, `non_residential` or `protected` |
| `connection_type` | `electricity` or `gas` |
| `is_green` | Whether the contract is for green energy |

## Example

```yaml
type: members
name: demo
source: { type: demo_members }
```
