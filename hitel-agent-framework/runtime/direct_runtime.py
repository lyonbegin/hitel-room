"""Single-device, in-memory direct action queue. No action runs without a native approved session."""
import threading
import time
import uuid
from starlette.responses import JSONResponse
from starlette.routing import Route

def register(mcp):
    jobs = {}
    lock = threading.Lock()
    allowed = {"get_screen_info", "open_app", "tap", "swipe", "back", "home"}

    @mcp.tool()
    def hitel_direct_action(action: str, args: dict) -> dict:
        """Queue one low-level action for the approved PokeClaw session. Poll status for actual result."""
        if action not in allowed or not isinstance(args, dict) or len(str(args)) > 2000:
            raise ValueError("Unsupported action or arguments")
        with lock:
            now = time.monotonic()
            for key in list(jobs):
                if now - jobs[key]["created"] > 180:
                    del jobs[key]
            if any(j["state"] in ("queued", "running") for j in jobs.values()):
                raise ValueError("One outstanding action allowed")
            request_id = uuid.uuid4().hex
            jobs[request_id] = {"action": action, "args": args, "created": now, "state": "queued"}
        return {"id": request_id, "state": "queued"}

    @mcp.tool()
    def hitel_direct_status(request_id: str) -> dict:
        """Return the actual native result; no success inferred from queue submission."""
        with lock:
            job = jobs.get(request_id)
            return {"state": job["state"], "result": job.get("result")} if job else {"state": "not_found"}

    async def pending(request):
        with lock:
            for key, job in jobs.items():
                if job["state"] == "queued" and time.monotonic() - job["created"] < 25:
                    job["state"] = "running"
                    return JSONResponse({"id": key, "action": job["action"], "args": job["args"]})
        return JSONResponse({})

    async def finish(request):
        if len(await request.body()) > 128000:
            return JSONResponse({"error": "oversize"}, 413)
        try:
            result = await request.json()
            if not isinstance(result, dict) or not isinstance(result.get("ok"), bool):
                raise ValueError()
        except (TypeError, ValueError):
            return JSONResponse({"error": "invalid"}, 400)
        with lock:
            job = jobs.get(request.path_params["request_id"])
            if not job or job["state"] != "running":
                return JSONResponse({"error": "invalid state"}, 409)
            job["state"] = "completed" if result["ok"] else "failed"
            job["result"] = result
        return JSONResponse({"state": job["state"]})
    return [Route("/device/actions/pending", pending, methods=["GET"]),
            Route("/device/actions/{request_id}", finish, methods=["POST"])]
