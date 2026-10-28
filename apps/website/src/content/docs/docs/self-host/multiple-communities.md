---
title: Host several communities
description: Run the management API, console and runner to host Cofy for more than one community.
sidebar:
  order: 2
---

If you host Cofy for more than one community, Cofy also ships a management API and a web console. With them you create and configure each community's setup without touching code.

Three parts work together:

- The **management API** stores each community's configuration.
- The **console** is the web interface on top of it.
- The **runner** serves each community's configuration as its own Cofy API.

[apps/demo_multitenant](https://github.com/EnergieID/cofy-api/tree/main/apps/demo_multitenant) shows how they fit together, how to run them locally, and how to build and deploy the combined Docker image.
