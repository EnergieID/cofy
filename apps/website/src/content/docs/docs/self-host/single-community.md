---
title: Run one community yourself
description: Install and run your own Cofy API for a single community.
sidebar:
  order: 1
---

Running your own Cofy API for one community is the simplest way to self-host. It needs no separate database or console.

## Start from the template

The fastest start is [cofy-api-template](https://github.com/EnergieID/cofy-api-template), a repository set up to fork and run.

## Or build it up yourself

Install Cofy with only the modules and integrations you need. For example, the tariff module with ENTSO-E prices:

```sh
pip install "cofy-api[tariff,entsoe]"
```

Create an `app.py`:

```python
from cofy.api import CofyAPI
from cofy.integrations.entsoe import EntsoeDayAheadTariffSource
from cofy.modules.tariff import TariffModule

app = CofyAPI()
app.register_module(TariffModule(source=EntsoeDayAheadTariffSource(api_key="YOUR_ENTSOE_KEY"), name="entsoe"))
```

Run it:

```sh
fastapi dev app.py
```

Your API is now at `http://127.0.0.1:8000`, with interactive API docs at `/docs`.

## Next steps

- The [packages/api README](https://github.com/EnergieID/cofy-api/tree/main/packages/api) covers every module and integration, caching, secrets, resources, and configuring from a settings file.
- Two worked examples: [assembled in Python](https://github.com/EnergieID/cofy-api/tree/main/apps/demo_cofy_api) and [assembled from a settings file](https://github.com/EnergieID/cofy-api/tree/main/apps/demo_cofy_api_settings).
