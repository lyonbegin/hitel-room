#!/usr/bin/env python3
"""Build a sanitized, read-only monitoring snapshot for GitHub Pages.

Runs only on GitHub Actions. Reads the *existing* public HITEL endpoints.
Never deploys to, writes to, authenticates to, or modifies Railway.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = "https://hitel-integration-api-production.up.railway.app"
PATHS = {
    "status": "/integrations/v1/public/status",
    "rooms": "/integrations/v1/public/rooms",
    "worker": "/integrations/v1/worker/autostart",
}
MAX_BODY_BYTES = 300_000

def read_public(path: str) -> dict:
    url = BASE + path
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json",
                 "User-Agent": "HITEL-GitHub-Pages-ReadOnly-Monitor/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=16) as response:
            if response.status != 200:
                return {"ok": False, "error": "HTTP_" + str(response.status)}
            body = response.read(MAX_BODY_BYTES + 1)
            if len(body) > MAX_BODY_BYTES:
                return {"ok": False, "error": "RESPONSE_TOO_LARGE"}
            result = json.loads(body)
            if not isinstance(result, dict):
                raise ValueError("not_a_JSON_object")
            return {"ok": True, "data": result}
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": "HTTP_" + str(exc.code)}
    except (urllib.error.URLError, TimeoutError, OSError, ValueError,
            json.JSONDecodeError) as exc:
        return {"ok": False, "error": type(exc).__name__}

def sanitize_status(raw: dict) -> dict:
    return {
        "worker_connected": bool(raw.get("worker_connected")),
        "worker_autostart_configured": bool(raw.get("worker_autostart_configured")),
        "same_room_name_reuses_conversation":
            bool(raw.get("same_room_name_reuses_conversation")),
        "supported": str(raw.get("supported", "unknown"))[:32],
    }

def sanitize_worker(raw: dict) -> dict:
    result = {
        "worker_connected": bool(raw.get("worker_connected")),
        "auto_start_configured": bool(raw.get("auto_start_configured")),
        "launch_status": str(raw.get("launch_status", "unknown"))[:40],
    }
    for key in ("launch_attempts", "pending_verified_chat_jobs"):
        val = raw.get(key)
        if isinstance(val, int) and not isinstance(val, bool) and val >= 0:
            result[key] = val
    return result

def sanitize_rooms(raw: dict) -> dict:
    rooms = raw.get("rooms")
    if not isinstance(rooms, list):
        raise ValueError("rooms_not_a_list")
    safe = []
    for row in rooms[:250]:
        if not isinstance(row, dict):
            continue
        name = row.get("room_name")
        identifier = row.get("room_id")
        if not isinstance(name, str) or not isinstance(identifier, str):
            continue
        safe.append({
            "room_name": name[:160],
            "room_id": identifier[:64],
            "conversation_linked": bool(row.get("conversation_linked")),
        })
    return {"rooms": safe, "reported_count": len(rooms),
            "is_truncated": len(rooms) > len(safe)}


def collect_github_actions() -> dict:
    """Read only PUBLIC GitHub Actions metadata for configured programs.

    GitHub runs are not proof that a ChatGPT reply is being generated.
    Never report a run name as a verified ChatGPT room name.
    """
    config_path = pathlib.Path(__file__).with_name("services.json")
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        services = config.get("services", [])
    except (OSError, ValueError, TypeError):
        services = []
    token = os.getenv("GH_TOKEN", "").strip()
    runs = {}
    errors = []
    checked_repos = []
    for item in services[:10]:
        if not isinstance(item, dict):
            continue
        repo = item.get("repository", "")
        if not isinstance(repo, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            continue
        checked_repos.append(repo)
        for suffix in ("?per_page=40&status=in_progress",
                       "?per_page=30&status=queued",
                       "?per_page=30"):
            url = "https://api.github.com/repos/" + repo + "/actions/runs" + suffix
            headers = {"Accept": "application/vnd.github+json",
                       "User-Agent": "HITEL-Pages-Monitor-ReadOnly/2.0",
                       "X-GitHub-Api-Version": "2022-11-28"}
            if token:
                headers["Authorization"] = "Bearer " + token
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=12) as response:
                    body = response.read(900_001)
                    if len(body) > 900_000:
                        raise ValueError("too_large")
                    payload = json.loads(body)
                for row in payload.get("workflow_runs", []):
                    if not isinstance(row, dict) or not isinstance(row.get("id"), int):
                        continue
                    address = str(row.get("html_url", ""))
                    if not address.startswith("https://github.com/" + repo + "/actions/runs/"):
                        continue
                    entry = {
                        "run_id": row["id"], "repo": repo,
                        "program": str(item.get("name", repo))[:70],
                        "workflow": str(row.get("name", ""))[:120],
                        "task": str(row.get("display_title", ""))[:200],
                        "status": str(row.get("status", "unknown"))[:24],
                        "conclusion": str(row.get("conclusion") or "")[:32],
                        "created_at": row.get("created_at"),
                        "run_started_at": row.get("run_started_at"),
                        "updated_at": row.get("updated_at"),
                        "url": address,
                    }
                    runs[str(row["id"])] = entry
            except (urllib.error.HTTPError, urllib.error.URLError, OSError,
                    ValueError, TimeoutError, TypeError) as exc:
                errors.append({"repo": repo, "type": type(exc).__name__})
    statuses = {"in_progress", "queued", "pending", "waiting", "requested"}
    results = list(runs.values())
    active = sorted([r for r in results if r["status"] in statuses],
                    key=lambda r: r["created_at"] or "", reverse=True)[:40]
    recent = sorted([r for r in results if r["status"] not in statuses],
                    key=lambda r: r["created_at"] or "", reverse=True)[:14]
    return {"ok": bool(runs), "active": active, "recent": recent,
            "repos": checked_repos, "errors": errors[:12],
            "note": "GitHub Actions status only; not ChatGPT room job state"}


def build() -> dict:
    sources = {}
    methods = {
        "status": sanitize_status,
        "worker": sanitize_worker,
        "rooms": sanitize_rooms,
    }
    for name, path in PATHS.items():
        response = read_public(path)
        if response.get("ok"):
            try:
                response["data"] = methods[name](response["data"])
            except (ValueError, KeyError, TypeError):
                response = {"ok": False, "error": "INVALID_PUBLIC_RESPONSE"}
        sources[name] = response
        print("SOURCE", name, "OK" if response["ok"] else response["error"])
    return {
        "schema_version": 1,
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "read_only": True,
        "railway_modified": False,
        "sources": sources,
        "actions": collect_github_actions(),
        "limitations": {
            "individual_job_totals": "not_available_via_existing_public_API",
            "automatic_snapshot_frequency": "scheduled_every_five_minutes",
            "question_or_response_content": "not_collected",
            "room_owner_names": "not_collected",
            "program_identity": "mapped_only_from_configured_room_prefixes",
            "room_job_status": "not_exposed_by_existing_public_API",
            "actions_status": "GitHub workflow state is not ChatGPT response state",
        }
    }

def main() -> None:
    destination = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("data/status.json")
    payload = build()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False,
                                      separators=(",", ":")) + "\n", encoding="utf-8")
    assert payload["read_only"] and not payload["railway_modified"]
    print("PASS_GITHUB_PAGES_MONITOR_SNAPSHOT", destination)
    print("UPSTREAM_OK_COUNT", sum(s["ok"] for s in payload["sources"].values()))

if __name__ == "__main__":
    main()
