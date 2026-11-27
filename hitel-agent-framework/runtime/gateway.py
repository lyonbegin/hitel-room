"""Single-device development gateway: upstream ARTEMIS MCP + approved PokeClaw tasks.
Not a multi-tenant production service. Run behind HTTPS; never expose unauthenticated.
"""
import hmac
import os
import sqlite3
import time
import uuid
from contextlib import closing
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from mcp_server.base import mcp
import mcp_server.tools  # register original tools

CONTROLLER = os.environ["HITEL_CONTROLLER_TOKEN"]
DEVICE = os.environ["HITEL_DEVICE_TOKEN"]
if min(len(CONTROLLER), len(DEVICE)) < 32 or CONTROLLER == DEVICE:
    raise RuntimeError("Distinct tokens, >=32 characters, required")
DB = os.environ.get("HITEL_TASK_DB", "hitel-tasks.sqlite")
TERMINAL = {"completed", "failed", "cancelled", "blocked", "rejected"}

def connect():
    conn = sqlite3.connect(DB, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

with closing(connect()) as conn, conn:
    conn.execute("""CREATE TABLE IF NOT EXISTS tasks(
        id TEXT PRIMARY KEY, goal TEXT NOT NULL, status TEXT NOT NULL,
        created REAL NOT NULL, detail TEXT NOT NULL DEFAULT '')""")

@mcp.tool()
def hitel_submit_task(goal: str) -> dict:
    """Queue a phone task for explicit review and approval on the registered PokeClaw device.
    The user must open the bridge and approve. This does not mean the task has run.
    """
    if not goal.strip() or len(goal) > 4000:
        raise ValueError("Goal must be 1–4000 characters")
    request_id = uuid.uuid4().hex
    with closing(connect()) as conn, conn:
        conn.execute("INSERT INTO tasks(id,goal,status,created) VALUES(?,?,?,?)",
                     (request_id, goal.strip(), "queued", time.time()))
    return {"request_id": request_id, "status": "queued"}

@mcp.tool()
def hitel_task_status(request_id: str) -> dict:
    """Read a queued PokeClaw task's actual callback state, not an inferred result."""
    with closing(connect()) as conn:
        row = conn.execute("SELECT id,status,detail FROM tasks WHERE id=?", (request_id,)).fetchone()
    return dict(row) if row else {"status": "not_found"}

async def pending(request: Request):
    with closing(connect()) as conn:
        row = conn.execute("SELECT id,goal FROM tasks WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
    return JSONResponse(dict(row) if row else {})

async def update(request: Request):
    try:
        data = await request.json()
        status = data["status"]
        detail = data.get("detail", "")
        if not isinstance(detail, str) or len(detail) > 12000:
            raise ValueError()
        allowed = {"approved": {"queued"}, "accepted": {"approved"},
                   "completed": {"approved", "accepted"}, "failed": {"approved", "accepted"},
                   "cancelled": {"approved", "accepted"}, "blocked": {"approved", "accepted"},
                   "rejected": {"queued", "approved", "accepted"}}
        prior = allowed[status]
    except (KeyError, TypeError, ValueError):
        return JSONResponse({"error": "invalid update"}, 400)
    with closing(connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT status FROM tasks WHERE id=?", (request.path_params["task_id"],)).fetchone()
        if not row:
            return JSONResponse({"error": "unknown task"}, 404)
        if row["status"] == status:
            return JSONResponse({"status": status})
        if row["status"] not in prior:
            return JSONResponse({"error": "invalid transition"}, 409)
        conn.execute("UPDATE tasks SET status=?,detail=? WHERE id=?",
                     (status, detail, request.path_params["task_id"]))
    return JSONResponse({"status": status})

from skills_runtime import register as register_skills
register_skills(mcp, connect)

from direct_runtime import register as register_direct
direct_routes = register_direct(mcp)
app = mcp.streamable_http_app()
app.router.routes.extend(direct_routes)
app.router.routes.extend([
    Route("/device/pending", pending, methods=["GET"]),
    Route("/device/tasks/{task_id}", update, methods=["POST"]),
])

class Auth:
    def __init__(self, inner):
        self.inner = inner
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope["path"]
            expected = DEVICE if path.startswith("/device/") else CONTROLLER
            headers = dict(scope["headers"])
            actual = headers.get(b"authorization", b"")
            if not hmac.compare_digest(actual, ("Bearer " + expected).encode()):
                await JSONResponse({"error": "unauthorized"}, 401)(scope, receive, send)
                return
        await self.inner(scope, receive, send)

application = Auth(app)
