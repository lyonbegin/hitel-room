#!/usr/bin/env python3
"""Short-lived ORIGINAL Expression2 HTTP protocol fixture for GitHub Actions.

This is NOT a deployed authentication service and NEVER authenticates production
users. Runs on CI runner loopback only; every response uses synthetic test
credentials and records only JSON field names/types, not secret values.
"""
import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CI_TOKEN = "EXPR2_CI_FIXTURE_ONLY_NOT_A_SECRET"

def fieldtypes(obj):
    if isinstance(obj, dict):
        return {str(k): fieldtypes(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fieldtypes(obj[0])] if obj else []
    return type(obj).__name__

class Api(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "-1"))
        if length < 2 or length > 65536:
            return self.reply(413, {"error": "invalid_content_length"})
        body = self.rfile.read(length)
        try:
            payload = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"error": "invalid_utf8_json"})
        if not isinstance(payload, dict):
            return self.reply(400, {"error": "body_must_be_object"})
        token = self.headers.get("Authorization", "")
        auth_ok = token == ("Bearer " + CI_TOKEN)
        content_type = self.headers.get("Content-Type", "").split(";")[0].strip()
        if self.path not in ("/v1/auth/validate", "/v1/meter/beats"):
            return self.reply(404, {"error": "not_found"})
        if content_type != "application/json":
            return self.reply(415, {"error": "unsupported_media_type"})
        record = {
            "method": self.command, "path": self.path,
            "content_type": content_type,
            "authorization_scheme": token.split(" ", 1)[0] if token else "",
            "authenticated_synthetic_fixture": auth_ok,
            "json_field_types": fieldtypes(payload),
            "bytes_received": len(body),
        }
        with self.server.log_lock:
            with self.server.logfile.open("a", encoding="utf-8") as out:
                out.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        if not auth_ok:
            return self.reply(401, {"valid": False, "code": "INVALID_CI_FIXTURE_CREDENTIAL"})
        if self.path == "/v1/auth/validate":
            # Synthetic success response. Only transport/bytecode return shape
            # is validated here; vendor service semantics are NOT asserted.
            return self.reply(200, {"valid": True, "meter_tail": True})
        return self.reply(200, {"meter_tail": True})

    def reply(self, code, obj):
        data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=18762)
    p.add_argument("--log", type=Path, required=True)
    args = p.parse_args()
    if args.host not in ("127.0.0.1", "::1"):
        raise SystemExit("CI mock must bind only to loopback")
    args.log.parent.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer((args.host, args.port), Api) as server:
        server.logfile = args.log
        server.log_lock = threading.Lock()
        print(f"EXPR2_CI_EPHEMERAL_BACKEND_READY http://{args.host}:{args.port}", flush=True)
        server.serve_forever(poll_interval=0.2)


if __name__ == "__main__":
    main()
