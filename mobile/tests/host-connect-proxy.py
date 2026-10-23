#!/usr/bin/env python3
"""Minimal HTTPS CONNECT proxy for the GitHub Android emulator smoke test.

Android guest DNS on some hosted runners cannot resolve the Railway domain.
The emulator reaches the host on 10.0.2.2; the host resolves and tunnels TLS.
The proxy is deliberately limited to the one configured HITEL origin.
"""

import http.server
import select
import socket
import socketserver
import sys

ALLOWED_HOSTS = {"hitel-web-preview-production.up.railway.app", "hitel-communication-web-production.up.railway.app", "hitel-device-relay-production.up.railway.app"}
PORT = 18888


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_CONNECT(self):
        host, separator, port_text = self.path.rpartition(":")
        if not separator or host.lower() not in ALLOWED_HOSTS or port_text != "443":
            self.send_error(403, "Only the HITEL HTTPS origin is allowed")
            return
        try:
            upstream = socket.create_connection((host, 443), timeout=20)
        except OSError as error:
            self.send_error(502, f"Upstream connection failed: {error}")
            return
        self.wfile.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        self.wfile.flush()
        self.log_message("HTTPS tunnel opened: %s", host)
        self.connection.settimeout(None)
        upstream.settimeout(None)
        sockets = [self.connection, upstream]
        try:
            while True:
                readable, _, _ = select.select(sockets, [], [], 90)
                if not readable:
                    break
                for source in readable:
                    payload = source.recv(65536)
                    if not payload:
                        return
                    dest = upstream if source is self.connection else self.connection
                    dest.sendall(payload)
        except (OSError, ConnectionError):
            pass
        finally:
            upstream.close()

    def do_GET(self):
        self.send_error(403, "HTTPS CONNECT only")

    def do_POST(self):
        self.send_error(403, "HTTPS CONNECT only")


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    server = Server(("0.0.0.0", PORT), Handler)
    print(f"HITEL_PROXY_READY port={PORT} hosts={','.join(sorted(ALLOWED_HOSTS))}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
