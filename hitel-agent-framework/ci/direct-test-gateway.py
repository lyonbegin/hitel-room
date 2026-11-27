"""Local CI harness for the same native direct routes used by the ARTEMIS gateway."""
import hmac
import os
from mcp.server.fastmcp import FastMCP
from starlette.responses import JSONResponse
from direct_runtime import register
mcp = FastMCP("HITEL direct CI")
routes = register(mcp)
app = mcp.streamable_http_app()
app.router.routes.extend(routes)
async def application(scope, receive, send):
    if scope["type"] == "http":
        token = os.environ["HITEL_DEVICE_TOKEN"] if scope["path"].startswith("/device/") else os.environ["HITEL_CONTROLLER_TOKEN"]
        if not hmac.compare_digest(dict(scope["headers"]).get(b"authorization", b""), ("Bearer "+token).encode()):
            await JSONResponse({"error":"unauthorized"},401)(scope,receive,send)
            return
    await app(scope, receive, send)
