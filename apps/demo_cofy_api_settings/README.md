# COFY API demo (settings file)

The same instance as [demo-cofy-api](../demo_cofy_api), built instead from a declarative
[settings.yaml](settings.yaml) via `CofyAPI.create(...)` (`FromSettingsMixin`). See
[main.py](main.py).

This is a worked example of route 1 in the [root README](../../README.md) - one community,
self-hosted, configured through a settings file rather than Python code. To start your own,
fork [cofy-api-template](https://github.com/EnergieID/cofy-api-template), or see
[packages/api](../../packages/api) for the package this demo is built from.

## Running

```sh
task demo-cofy-api-settings
```

The API is available at http://127.0.0.1:8000 with docs at `/docs`, using the token `demo`.

## Data

`data/` holds committed, read-only example config that `main.py` loads at startup (the modules
registered from `settings.yaml` are configured there directly). Nothing here is written to at
runtime.
