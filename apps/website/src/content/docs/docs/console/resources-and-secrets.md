---
title: Resources and secrets
description: Configure something once and use it in several modules, and keep credentials safe.
sidebar:
  order: 2
---

## Resources

A [resource](/docs/concepts/#resource) is a value you configure once and use in several places. There are three kinds:

| Kind | What it holds | Use it for |
| --- | --- | --- |
| `source` | A time series source | One source used by several modules, such as day-ahead prices for both a tariff and a directive. It is fetched once, so the modules also share what it has cached. |
| `member_source` | Where the members list comes from | The [members module](/docs/modules/members/) |
| `tariff` | A tariff, in [energy-cost's format](/docs/energy-cost/tariffs/) | A tariff served by a tariff module and also used elsewhere |

### Adding a resource

1. On the Resources tab, click **Add resource**.
2. Choose its **kind**, give it a **name** and, optionally, a description.
3. Fill in its value, as you would in a module's form.
4. Click **Create resource**.

Or, while filling in a module, open the **⋮** menu of a source or tariff and choose **Save as resource**: what you filled in becomes a resource, and the module uses it.

### Using a resource

In a module's form, open the **⋮** menu of a field where a resource fits and choose **Use a resource**, then pick it. **Specify a value** switches back to filling it in.

Changing a resource changes it for every module that uses it. A resource that is still in use can't be deleted; remove it from those modules first.

## Secrets

A [secret](/docs/concepts/#secret) is a credential, such as an API key or a password. You store it once, on the Secrets tab, and modules refer to it by name.

1. On the Secrets tab, click **Add secret**.
2. Give it a **name**, such as `entsoe_key`, and, optionally, a description of what it is for.
3. Paste its **value** and click **Save**.

A secret's value is never shown again, not even to you. To change it, edit the secret and enter the new value: every module using it picks up the new value.

In a module's form, a credential field lets you **choose a secret**, or create a **new secret** on the spot.

:::tip
Some credentials are a whole block of JSON, such as the key for an [EvO](/docs/sources/evo/) forecast. Paste it as it is.
:::
