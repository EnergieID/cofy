# Multitenant demo

Runs the management API together with the management console, so several communities can be
configured and operated through the UI, and the runner, which serves each community's own
`cofy-api` from its configuration. Demonstrates hosting more than one `cofy-api` configuration
behind a single management layer.

This is a worked example of route 2 in the [root README](../../README.md) - several
communities, with a management UI. It's the reference for anyone hosting Cofy on behalf of more
than one community: what to run, how the pieces talk to each other, and how to package and
deploy them.

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
takes the path prefix a proxy strips in `UVICORN_ROOT_PATH`. Both log as `logging.yaml` says (`UVICORN_LOG_CONFIG`):
every record to stderr, starting with its time, level and logger, and for one the runner logs while serving a
community's request, that community's slug, as in `cofy.modules.timeseries.cache [klimaan]:`. Both honor a `VERSION` build arg for
`APP_VERSION`. `/data/access/users.yaml` is the file to edit to change who the system admins are.

## Production deploy

EnergyID runs two servers this way, dev and production, each on a Scaleway instance set up by `cloud-init.yaml`.
`.github/workflows/deploy-scaleway.yml` builds both images on every push to `main`, tagged with the commit, pushes
them to `ghcr.io`, and deploys them to dev. Run by hand, `.github/workflows/deploy-production.yml` releases `main` as
the next `cloud-v<YYYY.MM.DD.N>` tag and deploys its images to production, or deploys an earlier tag again, to go back to it. On
the server,
`docker-compose.yml` runs them as `app`, the management API, and `runner`, which mounts only the community configs,
read-only - behind `caddy` (`Caddyfile`) for TLS. Caddy sends `/communities/<slug>/...` to the runner and everything
else to the management API. The public website ([apps/website](../website)) is built into an image of its own in the
same workflows, and runs beside them as `website`; Caddy serves it on the server's `COFY_WEBSITE_DOMAIN`. None of them has a published port, so the only way in from outside is through Caddy's
automatic Let's Encrypt HTTPS on 80/443. `caddy_data`/`caddy_config` (the issued certificate and Caddy's own state) are
named volumes, so a redeploy doesn't force reissuing the certificate. `alloy` ships the logs of the `cofy` project's
containers to Loki (`config.alloy`), each record whole - a traceback with the line it belongs to - and labelled with
the environment, the compose service and its level - and the server's metrics to Prometheus, as
[Monitoring](#monitoring) describes.

Both workflows deploy through `.github/workflows/deploy-to-server.yml`, logging in as `deploy`, whose key can run
nothing but `cofy-deploy`. That deploys a branch or tag only if the server's `COFY_DEPLOY_REFS` allows it: it reads
the commit from GitHub itself, fetches that commit's `docker-compose.yml`, `Caddyfile` and `config.alloy` into
`/opt/cofy`, and runs the images built from it. Each GitHub environment, `multitenant-dev` and `multitenant-prod`, has
its server's `SCALEWAY_SSH_HOST`, `SCALEWAY_SSH_KEY` (the deploy key's private half) and `SCALEWAY_SSH_KNOWN_HOSTS`
(the server's host key, as `ssh-keyscan` prints it) secrets.

Each server needs what the repository doesn't carry:

- `/opt/cofy/.env`, with its domains, which refs it deploys, its login configuration and where its logs go -
  `.env.example` lists them;
- the data, on a volume labelled `cofy-data`, mounted at `/data`.

This is how EnergyID runs its own hosted instance, not generally reachable images - the
`ghcr.io/energieid/cofy-api/management` and `.../runner` packages are private, so
`docker-compose.yml` as committed here only works for EnergyID's own deploy. To deploy your own
copy the same way, build and push the images to a registry you control, and point
`docker-compose.yml` and `cofy-deploy` at those and your repository instead.

## Monitoring

EnergyID's Grafana, at `logs.energyid.eu`, shows how the servers are doing and alerts when they aren't; its
dashboards and alert rules live there, in the Cofy folder. From each server, `alloy` sends:

- to Loki, every container's logs, Caddy's included: it logs every request (`Caddyfile`), with its status and how long
  it took, but not its headers or the `token` in its query;
- to Prometheus, every minute, the host's CPU, memory and disks, the CPU, memory and start time of each service's
  processes, and whether the console (`/`) and the communities' APIs (`/communities/`) answer at the public URL.

Each server's `/opt/cofy/.env` says where they go: `LOKI_URL` and `PROMETHEUS_URL`
(`https://logs.energyid.eu/cofy/<environment>/loki/api/v1/push` and `.../prometheus/api/v1/write`), with the
environment's credential in `LOKI_USERNAME` and `LOKI_PASSWORD`, and again in `PROMETHEUS_USERNAME` and
`PROMETHEUS_PASSWORD`. Without them, the deploy fails.

The `cofy-logs` skill (`.claude/skills/cofy-logs/`) lets Claude Code search these logs and metrics while debugging.
