---
title: The management console
description: Configure your community's COFY API from your browser, without writing code.
sidebar:
  label: Overview
  order: 0
---

The management console is where you set up and change your community's COFY API. Everything you change there is live within seconds; you never install or restart anything.

## Logging in

Open the console's address and log in with your account at your COFY host, such as your EnergyID account for the COFY that EnergyID hosts. Use the email address you were given access with.

If you see no communities after logging in, nobody has given you access yet: ask whoever manages your community, or your COFY host, to [give you access](/docs/console/access/).

## Your communities

The first page lists the communities you have access to, with how many modules each has and the status of its API. Click a community to open it.

At the top of a community's page you find:

- **Its API address**, with a button to copy it. Apps use this address to reach your community's data; see [connect an app](/docs/console/api-tokens/).
- **The status of its API**:

  | Status | What it means |
  | --- | --- |
  | Live | The API runs your latest saved settings. |
  | Changes pending | The API still runs the previous settings. Saved changes normally apply within a few seconds; if this stays, the new settings could not be applied: ask your COFY host. |
  | Unavailable | The API is not running. Ask your COFY host. |

Below them, a community has these tabs:

| Tab | What you do there |
| --- | --- |
| [Modules](/docs/console/modules/) | Switch on the modules your community needs, and configure each one |
| [Resources](/docs/console/resources-and-secrets/#resources) | Configure things several modules share, like a data source or a tariff |
| [Secrets](/docs/console/resources-and-secrets/#secrets) | Store credentials, such as an API key, without showing them again |
| [API tokens](/docs/console/api-tokens/) | Create the keys other applications use to call your community's API |
| [Access](/docs/console/access/) | Decide who else can manage this community |

You only see the tabs you are allowed to use.

## Your settings

The button at the top right opens your settings: light or dark appearance, the console's language, and logging out.

## Where to start

1. Read the [concepts](/docs/concepts/), to know what modules, sources and resources are.
2. [Add your first module](/docs/console/modules/#adding-a-module).
3. [Create an API token](/docs/console/api-tokens/) for the app that will use it.
