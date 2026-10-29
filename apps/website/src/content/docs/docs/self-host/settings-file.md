---
title: The settings file
description: Everything a community's settings file can hold.
sidebar:
  order: 2
---

A community's settings describe its whole Cofy API: its modules, what they share, its credentials and who may call it. You write it yourself when you [run one community yourself](/docs/self-host/single-community/); in a hosted Cofy, the [console](/docs/console/) writes it for you.

```yaml
type: cofy_api
title: Our community
description: Prices and production for the members of our community.

secrets:
  - name: entsoe_key
    value: ${ENTSOE_API_KEY}

resources:
  - type: source
    name: day_ahead
    value:
      type: entsoe_day_ahead
      api_key: { type: secret, name: entsoe_key }

modules:
  - type: tariff
    name: day-ahead
    source: { type: resource, name: day_ahead }
  - type: directive
    name: prices
    source:
      type: directive
      source: { type: resource, name: day_ahead }
      boundaries: [0, 10, 25, 50]
      reverse: true

auth:
  type: token
  tokens:
    - name: website
      hash: ${WEBSITE_TOKEN_HASH}
```

## Fields

| Field | What it is |
| --- | --- |
| `type` | Always `cofy_api`. Required. |
| `title` | The API's name, shown in its API docs. `Cofy API` if left out. |
| `description` | What the API is for, shown in its API docs |
| `modules` | The [modules](/docs/modules/) it serves |
| `resources` | Values used in several places; see [resources](#resources) |
| `secrets` | Credentials; see [secrets](#secrets) |
| `auth` | Who may call it; see [tokens](#tokens). Anyone may, if left out. |
| `debug_mode` | Profiles every request, for finding out what makes one slow; see [debug mode](#debug-mode). `false` if left out. |
| `debug_dir` | Where debug mode keeps its profiles. A temporary directory if left out. |
| `revision` | A number that goes up with every change. The API reports it at `/health`, and in its version, such as `0.9.0+12`. In a hosted Cofy, the console keeps it for you. |

Every module, resource and source has a `type`, which says what it is and which other fields it takes. Each module's and source's page lists them. The examples on those pages show a single module: add it to the `modules` list as one entry, starting with `- type:`.

## Secrets

A [secret](/docs/concepts/#secret) holds a credential, such as an API key, under a name:

```yaml
secrets:
  - name: entsoe_key
    description: Our ENTSO-E API key
    value: ${ENTSOE_API_KEY}
```

Every field that needs a credential refers to a secret instead of holding it: `{ type: secret, name: entsoe_key }`. That keeps credentials in one place, and out of the rest of the file.

To keep them out of the file entirely, the `app.py` of [run one community yourself](/docs/self-host/single-community/#3-load-it) fills in `${VARIABLES}` from the environment before reading the file. That is up to the code loading the file: Cofy itself reads only YAML.

## Resources

A [resource](/docs/concepts/#resource) is a value configured once, under a name, and referred to wherever one of its kind fits: `{ type: resource, name: day_ahead }`.

| `type` | What `value` holds | Fits wherever |
| --- | --- | --- |
| `source` | A time series source | a source of the same kind fits |
| `member_source` | Where the members list comes from | the [members module](/docs/modules/members/) takes its source |
| `tariff` | A tariff, in [energy-cost's format](/docs/energy-cost/tariffs/) | a tariff fits, as in the [energy-cost source](/docs/sources/energy-cost/#sharing-a-tariff) |

A source used as a resource is built once: every module using it shares one connection and one cache.

## Tokens

With `auth`, every request needs a token, except `/health`:

```yaml
auth:
  type: token
  tokens:
    - name: website
      description: Our community's website
      hash: sha256:4c1d…
      expires: 2027-01-01T00:00:00Z
```

| Field | What it is |
| --- | --- |
| `name` | Which token this is. Letters, digits, `-` and `_`; unique. |
| `description` | Who uses it. Optional. |
| `hash` | The hash of its key, so the key itself isn't in the file |
| `key` | The key itself, instead of its hash. Simpler, but anyone who can read the file can then use it. |
| `expires` | When it stops working. Optional. |

Generate a strong key and its hash with:

```sh
python -c "from cofy.api import generate_key, hash_key; key = generate_key(); print(key, hash_key(key))"
```

An app sends its key in a header, `Authorization: Bearer <key>`, or in the address, `?token=<key>`.

## Debug mode

With `debug_mode: true`, the API profiles every request, keeps the profiles of the last hundred, and adds a `/debug/{id}/profile` address to fetch one. It needs the `debug` extra: `pip install "cofy-api[debug]"`. It slows every request down, so only switch it on while looking into a problem.

## Tariffs that follow an index

An [energy-cost tariff](/docs/energy-cost/tariffs/#price-per-mwh) that follows an index, such as the day-ahead price, needs that index registered by name before the settings are read. Add it to `app.py`, before `CofyAPI.create`:

```python
from energy_cost.index import CachedIndex, EntsoeDayAheadIndex, Index

Index.register(
    "Belpex15min",
    CachedIndex(EntsoeDayAheadIndex("BE", api_key=os.environ["ENTSOE_API_KEY"]), file_name="belpex15min"),
)
```

See [indexes](/docs/energy-cost/python/#indexes) for the kinds of index there are. A hosted Cofy, run by the runner, can't register indexes yet ([#257](https://github.com/EnergieID/cofy/issues/257)).
