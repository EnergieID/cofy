---
title: Connect an app
description: Create API tokens, and let an app read your community's data.
sidebar:
  order: 3
---

Apps, such as your community's website, an energy app or a home battery, read your community's data from its API. Each app gets its own **API token**: a key that proves it may.

## Creating a token

1. On the API tokens tab, click **New token**.
2. Give it a **name**, such as `website`, and a description of which app uses it.
3. Optionally, choose a date from which it **expires**.
4. Click **Create**.
5. Copy the **key** and give it to the app's developer, or paste it into the app.

:::caution
The key is shown only once. COFY doesn't store it, so it can never be shown again. If you lose it, delete the token and create a new one.
:::

Once your community has a token, every request to its API needs one.

:::caution
Until you create the first token, your community's API is open to anyone who knows its address.
:::

## What the app needs

Give the app's developer:

- the API address, from the top of your community's page;
- the key;
- the addresses of the modules it should use, such as `/tariff/day-ahead/v1`;
- a link to [these docs](/docs/modules/).

An app sends the key in a header, `Authorization: Bearer <key>`, or, where it can't set headers, in the address: `?token=<key>`.

## Trying it in your browser

Every community's API describes itself. Open your API address followed by `/docs?token=<key>`: you see every module, and can try each one with **Try it out**.

## Stopping an app

Delete its token on the API tokens tab: from then on, the app can no longer reach your API. The other apps keep working, since each has its own token.
