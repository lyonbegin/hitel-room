"""Reuse the vendored, authorized HITEL transport; no OpenAI API key."""
import hashlib
import json
import os
import pathlib
import re
import tempfile
import threading
import time

import web2_client as upstream

_lock = threading.Lock()

class ContractError(ValueError):
    status_code = 400

class ApprovalError(PermissionError):
    status_code = 403

def approved_task():
    task = os.getenv("HITEL_ARTEMIS_TASK_ID", "")
    if os.getenv("HITEL_ARTEMIS_ALLOW_LIVE") != "true" or not re.fullmatch(r"artemis-[a-z0-9-]{1,55}", task):
        raise ApprovalError("New approved ARTEMIS task and explicit live authorization required")
    if not os.getenv("ACTIONS_ID_TOKEN_REQUEST_URL") or not os.getenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN"):
        raise ApprovalError("Authorized GitHub Actions OIDC context required")
    if os.getenv("GITHUB_RUN_ATTEMPT", "1") != "1":
        raise ApprovalError("Live rerun blocked: reconcile the original requests before a new run")
    return task

def identity(obj, req, job=None, room=None):
    if not isinstance(obj, dict) or obj.get("request_id") != req:
        raise ContractError("HITEL request identity mismatch")
    if not str(obj.get("job_id", "")).startswith("job_") or not str(obj.get("room_id", "")).startswith("room_"):
        raise ContractError("HITEL job/room identity missing")
    if job is not None and (obj["job_id"] != job or obj["room_id"] != room):
        raise ContractError("HITEL job/room mismatch")
    return obj

def complete(prompt, *, timeout=145, transport=upstream, sleep=time.sleep, clock=time.monotonic):
    task = approved_task()
    if not isinstance(prompt, str) or not 0 < len(prompt) <= 24000:
        raise ContractError("HITEL text request exceeds the documented 24,000-character limit")
    run = os.environ.get("GITHUB_RUN_ID")
    if not run or not run.isdigit():
        raise ApprovalError("GitHub run identity required")
    digest = hashlib.sha256((task + "\0" + run + "\0" + prompt).encode()).hexdigest()
    req = "hitel-artemis-" + digest[:40]
    directory = pathlib.Path(os.getenv("RUNNER_TEMP", tempfile.gettempdir())) / "hitel-artemis-requests" / run
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    marker = directory / (digest + ".attempted")
    with _lock:
        j = transport.get("/requests/" + req)
        if j is None:
            if marker.exists():
                raise ContractError("Prior submission uncertain; no duplicate POST")
            # Keep only the request ID, never raw prompt or credentials.
            with marker.open("x", encoding="utf-8") as f:
                f.write(req)
            j = transport.submit({"task_id": task}, {"request_id": req, "room_name": "HITEL-ARTEMIS-" + digest[:24]}, prompt)
        identity(j, req)
    job, room = j["job_id"], j["room_id"]
    deadline = clock() + timeout
    while clock() < deadline:
        response = identity(transport.get("/jobs/" + job), req, job, room)
        if response.get("status") == "completed":
            if not all(response.get(k) is True for k in ("result_ready", "chatgpt_send_confirmed", "assistant_reply_observed")):
                raise ContractError("HITEL response lacks completion evidence")
            return transport.result(job, response)
        if response.get("status") not in ("queued", "running", "stalled"):
            raise ContractError("HITEL job did not complete")
        sleep(min(10, max(0, deadline-clock())))
    raise TimeoutError("HITEL result pending; request retained for reconciliation")
