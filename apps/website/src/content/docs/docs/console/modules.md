---
title: Modules
description: Add, change and remove the modules of your community.
sidebar:
  order: 1
---

The Modules tab lists what your community's API serves. Each [module](/docs/concepts/#module) has a page in these docs describing what it does and every setting it has: see [modules](/docs/modules/).

:::tip[Copy an example from these docs]
Every module and source page in these docs has YAML examples you can use as they are. Click **View as YAML** at the top of the module form, paste the example, and adjust it. **View as form** takes you back, and the **⋮** menu of a single field does the same for just that field. Whatever you enter is checked as you type.
:::

## Adding a module

1. On the Modules tab, click **Add module**.
2. Choose the **module type**, such as Tariff. Only the types your community may use are offered.
3. Give it a **name**. The name becomes part of the module's address, such as `/tariff/dynamic/v1`, so keep it short: lowercase letters, digits, `-` and `_`. Leave it as `default` if your community has only one module of this type.
4. Optionally, give it a **display name** and a **description**, so others know what it is for.
5. Fill in the rest of the form, such as the module's **source**: where its data comes from.
6. Click **Create module**.

The module appears in the list, and the community's [status](/docs/console/#your-communities) shows **Changes pending** for a few seconds, then **Live** again. From then on, the module is served at your API address followed by `/{type}/{name}/v1`.

### Example: day-ahead prices

To serve the Belgian day-ahead market price, with an API key from ENTSO-E:

1. On the [Secrets](/docs/console/resources-and-secrets/#secrets) tab, add a secret named `entsoe_key`, with your ENTSO-E API key as its value.
2. Add a module of type Tariff, named `day-ahead`.
3. Under **Source**, choose the type Entsoe Day Ahead.
4. Under **Api Key**, choose the secret `entsoe_key`.
5. Click **Create module**.

The prices are now at `/tariff/day-ahead/v1`. The [ENTSO-E](/docs/sources/entsoe/) page lists what else you can set, such as the country.

## Filling in the form

The form follows the module you chose. Its fields are the settings listed on the module's page and its source's page, in words: the setting `api_key` is the field Api Key, and the source type `entsoe_day_ahead` is Entsoe Day Ahead.

A few things work the same everywhere:

- **Choosing a type.** Where a setting can be one of several kinds, such as a source, choose its type first; the fields for that type then appear below it.
- **Required fields** are marked with a `*`. You can't save while one is empty or a value is invalid: the field says what's wrong, and the button shows **Saving blocked by errors**.
- **Optional parts** that aren't there yet show a **Create** button. Click it to add them; the **⋮** menu beside them removes them again.
- **Lists**, such as a list of tariff versions, have an **Add** button, and each entry can be removed.
- **Advanced options** are folded away at the end of a section. You rarely need them; each is explained on the page of its module or source.
- **Credentials** are never typed into the form itself: choose one of your community's [secrets](/docs/console/resources-and-secrets/#secrets), or create a new one on the spot.
- **Resources.** Where a source or tariff fits, its **⋮** menu offers **Use a resource**, to pick one you configured on the [Resources](/docs/console/resources-and-secrets/#resources) tab, and **Save as resource**, to turn what you filled in into one, so other modules can use it too.

## Changing a module

Click a module in the list to open it. Change what you need and click **Save**, or **Discard** to undo your changes. The heading tells you whether there are unsaved changes.

A module's type and name can't be changed, because apps use them in its address. To rename one, add a new module and delete the old one.

## Deleting a module

Click **Delete** beside the module in the list. Its address stops working within seconds, and its settings can't be recovered.
