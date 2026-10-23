"""Reads the Cofy servers' logs, metrics and alerts from EnergyID's Grafana, and nothing else: it only ever sends GETs.

Takes Grafana's URL and a Viewer service account's token from GRAFANA_URL and GRAFANA_VIEWER_TOKEN, in the
environment or in the repository's `.env.local`.

    grafana.py logs '<LogQL>' [--since 1h] [--until now] [--limit 100] [--oldest-first]
    grafana.py metrics '<PromQL>' [--since 1h --step 5m]   (an instant query without --since)
    grafana.py labels [<label>]                             (Loki's labels, or one's values, on Cofy's logs)
    grafana.py alerts                                       (the Cofy alert rules that are firing or pending)
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENV_LOCAL = Path(__file__).resolve().parents[4] / ".env.local"
UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


def setting(name: str) -> str:
    """*name* from the environment, or else from `.env.local`."""
    if os.environ.get(name):
        return os.environ[name]
    if ENV_LOCAL.exists():
        for line in ENV_LOCAL.read_text().splitlines():
            key, _, value = line.partition("=")
            if key.strip() == name and value.strip():
                return value.strip().strip("'\"")
    sys.exit(f"{name} must be set, in the environment or in {ENV_LOCAL}")


def get(path: str, **params: str) -> object:
    """Grafana's answer to a GET of *path*."""
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    request = urllib.request.Request(
        setting("GRAFANA_URL").rstrip("/") + path + query,
        headers={"Authorization": f"Bearer {setting('GRAFANA_VIEWER_TOKEN')}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        sys.exit(f"GET {path}: {exc.code} {exc.read().decode()[:500]}")


def datasource(kind: str) -> str:
    """The proxy path of the data source of *kind*, `loki` or `prometheus`."""
    uids = [source["uid"] for source in get("/api/datasources") if source["type"] == kind]
    if len(uids) != 1:
        sys.exit(f"Expected one {kind} data source, found {len(uids)}")
    return f"/api/datasources/proxy/uid/{uids[0]}"


def seconds_ago(duration: str) -> float:
    """The Unix time *duration*, such as `90m` or `2d`, ago; `now` is now."""
    if duration == "now":
        return time.time()
    match = re.fullmatch(r"(\d+)([smhdw])", duration)
    if not match:
        sys.exit(f"{duration!r} is not a duration such as 30m, 6h or 2d")
    return time.time() - int(match[1]) * UNITS[match[2]]


def iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def logs(args: argparse.Namespace) -> None:
    answer = get(
        datasource("loki") + "/loki/api/v1/query_range",
        query=args.query,
        start=str(int(seconds_ago(args.since) * 1e9)),
        end=str(int(seconds_ago(args.until) * 1e9)),
        limit=str(args.limit),
        direction="forward" if args.oldest_first else "backward",
    )["data"]
    if answer["resultType"] != "streams":
        print(json.dumps(answer["result"], indent=1))
        return
    lines = [(int(ns), stream["stream"], line) for stream in answer["result"] for ns, line in stream["values"]]
    lines.sort(key=lambda entry: entry[0], reverse=not args.oldest_first)
    for ns, labels, line in lines:
        where = " ".join(labels.get(label, "-") for label in ("environment", "service", "level"))
        print(f"{iso(ns / 1e9)} [{where}] {line}")
    print(
        f"-- {len(lines)} lines{' (the limit; narrow the query or raise --limit)' if len(lines) >= args.limit else ''}"
    )


def metrics(args: argparse.Namespace) -> None:
    proxy = datasource("prometheus")
    if args.since:
        answer = get(
            proxy + "/api/v1/query_range",
            query=args.query,
            start=str(seconds_ago(args.since)),
            end=str(time.time()),
            step=args.step,
        )
    else:
        answer = get(proxy + "/api/v1/query", query=args.query)
    if answer["status"] != "success":
        sys.exit(json.dumps(answer))
    for series in answer["data"]["result"]:
        labels = ", ".join(f"{k}={v}" for k, v in sorted(series["metric"].items()))
        if "value" in series:
            print(f"{{{labels}}} {series['value'][1]}")
        else:
            print(f"{{{labels}}}")
            for timestamp, value in series["values"]:
                print(f"  {iso(float(timestamp))} {value}")
    print(f"-- {len(answer['data']['result'])} series")


def labels(args: argparse.Namespace) -> None:
    proxy = datasource("loki")
    path = f"/loki/api/v1/label/{args.label}/values" if args.label else "/loki/api/v1/labels"
    answer = get(proxy + path, query='{app="cofy"}', start=str(int(seconds_ago("7d") * 1e9)))
    print("\n".join(answer.get("data", [])))


def alerts(args: argparse.Namespace) -> None:
    groups = get("/api/prometheus/grafana/api/v1/rules")["data"]["groups"]
    found = 0
    for group in groups:
        if group.get("folderUid", group.get("file")) not in ("cofy", "Cofy"):
            continue
        for rule in group["rules"]:
            for alert in rule.get("alerts", []):
                if alert["state"].split(" ")[0].lower() in ("alerting", "pending", "firing", "error", "nodata"):
                    found += 1
                    print(f"{alert['state']}: {rule['name']} - {alert['annotations'].get('summary', '')}")
                    shown = {
                        k: v for k, v in alert["labels"].items() if not k.startswith("__") and k != "grafana_folder"
                    }
                    print(f"  since {alert.get('activeAt', '?')}, labels {shown}")
    print(f"-- {found} alerts firing or pending")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    command = commands.add_parser("logs")
    command.add_argument("query")
    command.add_argument("--since", default="1h")
    command.add_argument("--until", default="now")
    command.add_argument("--limit", type=int, default=100)
    command.add_argument("--oldest-first", action="store_true")
    command.set_defaults(run=logs)

    command = commands.add_parser("metrics")
    command.add_argument("query")
    command.add_argument("--since")
    command.add_argument("--step", default="5m")
    command.set_defaults(run=metrics)

    command = commands.add_parser("labels")
    command.add_argument("label", nargs="?")
    command.set_defaults(run=labels)

    command = commands.add_parser("alerts")
    command.set_defaults(run=alerts)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
