# Multitenant demo

Runs the management API together with the management console, so several communities can be
configured and operated through the UI, and the runner, which serves each community's own
`cofy-api` from its configuration. Demonstrates hosting more than one `cofy-api` configuration
behind a single management layer.

This is a worked example of route 2 in the [root README](../../README.md) - several
communities, with a management UI. It's the reference for anyone hosting Cofy on behalf of more
than one community: what to run, how the pieces talk to each other, and how to package them.

## Running

```sh
task demo-multitenant-reset   # first run only, or whenever you want to start over
task dev-idp                  # local identity provider on :8081 (needs Docker)
task demo-multitenant-api     # management API on :8000
task demo-multitenant-runner  # the communities' APIs on :8001, e.g. http://localhost:8001/demo/docs?token=demo
task demo-multitenant-web     # console dev server on :5173, proxying to the API
```

The API's and the runner's settings come from `.env.local` at the repository root: copy the
`COFY_MANAGEMENT_*` and `COFY_RUNNER_*` lines from `.env.example`, which point at the local
identity provider and runner, and fill in the absolute path of your checkout in
`COFY_MANAGEMENT_DATA_DIR`, `COFY_MANAGEMENT_COMMUNITIES_DIR` and `COFY_RUNNER_DIRECTORY`.

The runner picks up a change made in the console within a few seconds, and the console shows
whether a community's API runs its latest settings.

Opening the console sends you to the local identity provider ([`apps/dev_idp`](../dev_idp/docker-compose.yml))
to log in. Its users all have the password `pwd`:

| User         | Can                                                       |
|--------------|-----------------------------------------------------------|
| `admin`      | everything: a system admin                                |
| `demo-admin` | manage the `demo` community                               |
| `nobody`     | log in, and see that there is nothing for them            |

## Data

`seed/` holds the committed defaults. `task demo-multitenant-reset` copies it into
`.data/`, which is git-ignored and is what the management API actually reads and writes while
the demo runs. Run the reset task again any time to discard local changes and start from the
committed defaults.

It holds two directories, as two separate environments would: `communities/`, the community
configs (`COFY_MANAGEMENT_COMMUNITIES_DIR`, and `COFY_RUNNER_DIRECTORY` for the runner), and
`management/`, the rest of what the management API keeps (`COFY_MANAGEMENT_DATA_DIR`) - in
`access/users.yaml`, who may do what: the system admins, and each person's role in each community. Logging in writes each person's
identity in beside their email, so that file changes as you use the demo too.

## Docker

Each service has its own image, both built from the repo root, since each needs sources from
several packages:

- `management.Dockerfile` builds the management API and the console: the console is served by
  the API itself (same origin, so no CORS or base URL to configure - see
  `COFY_MANAGEMENT_STATIC_DIR` in `packages/management-api/src/cofy/management/main.py`);
- `runner.Dockerfile` builds the runner, which needs nothing but `cofy-api`.

```sh
task demo-multitenant-docker
```

Runs the same build and run of the management API as:

```sh
docker build -f apps/demo_multitenant/management.Dockerfile -t cofy-management-demo .
docker run --network host -v "$PWD/apps/demo_multitenant/.data/management:/data" -v "$PWD/apps/demo_multitenant/.data/communities:/communities" \
  --env-file .env.local -e COFY_MANAGEMENT_DATA_DIR=/data -e COFY_MANAGEMENT_COMMUNITIES_DIR=/communities cofy-management-demo
```

It logs in through `task dev-idp` too, which is why it runs on the host network: the container
and the browser must reach the identity provider at the same address. Run
`task demo-multitenant-runner` beside it for the communities' APIs.

In the management image, `/data` is where the users live and `/communities` where the community
configs do; the runner image only reads `/communities`. Both are mounted in from the host - here
the demo's own `.data/management` and `.data/communities`. The images bring no data of their own
and never seed or rewrite what is mounted there. Each runs plain uvicorn, which reads its options
from `UVICORN_*` variables: they listen on `UVICORN_PORT` (`8080` by default), and the runner
takes the path prefix a proxy strips in `UVICORN_ROOT_PATH`, and how they log as a logging config file in
`UVICORN_LOG_CONFIG`. The runner starts each record with its time, level and logger, and for one it logs while serving
a community's request, that community's slug, as in `cofy.modules.timeseries.cache [klimaan]:`. Both honor a `VERSION`
build arg for `APP_VERSION`. `/data/access/users.yaml` is the file to edit to change who the system admins are.

## Hosting it

EnergyID's hosted Cofy, at [cofy.cloud](https://cofy.cloud), builds its images the same way, in a private repository
that adds EnergyID's own integrations to them, and runs them behind a TLS-terminating proxy, with their logs and
metrics shipped to Grafana. To host your own, run both images the same way: the management API with `/data` and
`/communities` mounted, the runner with `/communities` read-only, behind a proxy that sends `/communities/<slug>/...` to
the runner, with the prefix stripped and given as `UVICORN_ROOT_PATH`, and everything else to the management API.
