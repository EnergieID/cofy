---
title: Run one community yourself
description: Install and run your own Cofy API for a single community.
sidebar:
  order: 1
---

Running your own Cofy API for one community is the simplest way to self-host. It needs no database and no console: you describe your community in a settings file, and Cofy serves it.

You need Python 3.11 or newer.

:::tip[Start from the template]
[cofy-api-template](https://github.com/EnergieID/cofy-api-template) is a repository ready to fork, with a Dockerfile to deploy it. This page shows how to start without it.
:::

## 1. Install

Install Cofy with the extras of the modules and sources you use. For day-ahead prices from ENTSO-E:

```sh
pip install "cofy-api[tariff,entsoe]"
```

Each [module](/docs/modules/) and [source](/docs/sources/) page names its extra. `cofy-api[all]` installs everything.

## 2. Describe your community

Create a `settings.yaml`. This one serves the Belgian day-ahead prices, and lets in only apps with a token:

```yaml
type: cofy_api
title: Our community
secrets:
  - name: entsoe_key
    value: ${ENTSOE_API_KEY}

modules:
  - type: tariff
    name: day-ahead
    source:
      type: entsoe_day_ahead
      country_code: BE
      api_key: { type: secret, name: entsoe_key }

auth:
  type: token
  tokens:
    - name: website
      hash: ${WEBSITE_TOKEN_HASH}
```

The [settings file](/docs/self-host/settings-file/) page describes everything it can hold; each module's and source's page has examples to copy.

## 3. Load it

Create an `app.py` next to it:

```python
import os
from pathlib import Path

import yaml
from cofy.api import CofyAPI
from cofy.modules.discovery import discover_all_types

# Make every installed module and source available to the settings.
discover_all_types()

# Fill in ${VARIABLES} from the environment, to keep credentials out of the file.
settings = yaml.safe_load(os.path.expandvars(Path(__file__).with_name("settings.yaml").read_text()))
app = CofyAPI.create(settings)
```

## 4. Run it

Create a key for your app, and its hash:

```sh
python -c "from cofy.api import generate_key, hash_key; key = generate_key(); print(key, hash_key(key))"
```

Give the key to the app, and the hash to Cofy, with your ENTSO-E key:

```sh
export ENTSOE_API_KEY=your-entsoe-key
export WEBSITE_TOKEN_HASH=sha256:…
fastapi dev app.py
```

Your API is now at `http://127.0.0.1:8000`:

- the prices at `/tariff/day-ahead/v1?token=<key>`;
- interactive API docs at `/docs?token=<key>`;
- a health check, without a token, at `/health`.

`fastapi dev` restarts when you change a file. Changing `settings.yaml` doesn't count: restart it yourself.

## Running it for real

- Run it with `fastapi run app.py`, or any ASGI server, such as `uvicorn app:app --host 0.0.0.0 --port 8080`.
- Put it behind a proxy that adds HTTPS: tokens travel with every request.
- If the proxy serves it under a path, such as `/cofy/`, strip that path in the proxy and pass it to uvicorn as `--root-path /cofy`, so the API docs point to the right place.
- `/health` answers `"status": "ok"` without a token, for your monitoring.

## Or assemble it in Python

Instead of a settings file, you can build the same API in code, which also lets you add [modules and sources of your own](/docs/extend/):

```python
from cofy.api import CofyAPI
from cofy.integrations.entsoe import EntsoeDayAheadTariffSource
from cofy.modules.tariff import TariffModule

app = CofyAPI()
app.register_module(TariffModule(source=EntsoeDayAheadTariffSource(api_key="YOUR_ENTSOE_KEY"), name="day-ahead"))
```

The repository has a worked example of each: [assembled in Python](https://github.com/EnergieID/cofy/tree/main/apps/demo_cofy_api) and [from a settings file](https://github.com/EnergieID/cofy/tree/main/apps/demo_cofy_api_settings).
