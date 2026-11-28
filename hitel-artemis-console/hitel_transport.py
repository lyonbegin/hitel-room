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
TASK_CONFIG = pathlib.Path(__file__).resolve().parent / 'web2-api' / 'task.json'

class ContractError(ValueError):
    status_code = 400

class ApprovalError(PermissionError):
    status_code = 403

def approved_task():
    # The original API uses a project JSON task_id and HITEL_ALLOW_LIVE.
    try:
        config = json.loads(TASK_CONFIG.read_text(encoding="utf-8"))
        task = config["task_id"]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise ApprovalError("Missing or invalid Web2 task configuration") from exc
    if not isinstance(task, str) or not re.fullmatch(r"[a-z][a-z0-9-]{2,63}", task) or not task.startswith("artemis-"):
        raise ApprovalError("A separate ARTEMIS task_id is required; existing projects cannot be reused")
    if os.getenv("HITEL_ALLOW_LIVE") != "true":
        raise ApprovalError("Original API approval missing: HITEL_ALLOW_LIVE=true; configured task_id="+task+" (server authorization unverified)")
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
    print("HITEL job accepted or reconciled; polling status", flush=True)
    deadline = clock() + timeout
    while clock() < deadline:
        response = identity(transport.get("/jobs/" + job), req, job, room)
        print("HITEL poll: " + str(response.get("status")), flush=True)
        if response.get("status") == "completed":
            if not all(response.get(k) is True for k in ("result_ready", "chatgpt_send_confirmed", "assistant_reply_observed")):
                raise ContractError("HITEL response lacks completion evidence")
            return transport.result(job, response)
        if response.get("status") not in ("queued", "running", "stalled"):
            raise ContractError("HITEL job did not complete")
        sleep(min(10, max(0, deadline-clock())))
    raise TimeoutError("HITEL result pending; request retained for reconciliation")
