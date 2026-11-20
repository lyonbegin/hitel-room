#!/usr/bin/env python3
"""Observe original model HTTP responses below redirects/authentication.

Adds a pass-through OkHttp network interceptor and an outer exception probe.
Logs only fixed route labels, numeric response codes and exception class names.
No requests, credentials, responses, authentication decisions or retries change.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = "com/lguplus/aicallagent/network/client/"
BASE = ROOT + "BaseServer.smali"
OUTER = ROOT + "IXIOPagesLoginMockInterceptor.smali"
PROBE = ROOT + "HitelModelWireTrace.smali"
DESC = "L" + PROBE[:-6] + ";"


def source() -> str:
    return r'''.class public final __DESC__
.super Ljava/lang/Object;
.implements Lokhttp3/Interceptor;

.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method

.method private static route(Lokhttp3/Request;)Ljava/lang/String;
    .registers 4
    invoke-virtual {p0}, Lokhttp3/Request;->url()Lokhttp3/HttpUrl;
    move-result-object v0
    invoke-virtual {v0}, Lokhttp3/HttpUrl;->encodedPath()Ljava/lang/String;
    move-result-object v0
    const-string v1, "/v1/ai-asset/check"
    invoke-virtual {v1, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v2
    if-nez v2, :auth
    const-string v1, "/v2/ai-model/check"
    invoke-virtual {v1, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v2
    if-nez v2, :version
    const/4 v0, 0x0
    return-object v0
    :auth
    const-string v0, "AUTH_CATALOG"
    return-object v0
    :version
    const-string v0, "VERSION_CATALOG"
    return-object v0
.end method

.method private static log(Ljava/lang/String;Ljava/lang/String;)V
    .registers 4
    const-string v0, ": "
    invoke-virtual {p0, v0}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v0
    invoke-virtual {v0, p1}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v0
    const-string v1, "IXIO_MODEL_WIRE"
    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    return-void
.end method

.method public intercept(Lokhttp3/Interceptor$Chain;)Lokhttp3/Response;
    .registers 8
    invoke-interface {p1}, Lokhttp3/Interceptor$Chain;->request()Lokhttp3/Request;
    move-result-object v0
    invoke-static {v0}, __DESC__->route(Lokhttp3/Request;)Ljava/lang/String;
    move-result-object v1
    if-eqz v1, :passthrough
    const-string v2, "WIRE_REQUEST"
    invoke-static {v1, v2}, __DESC__->log(Ljava/lang/String;Ljava/lang/String;)V
    :try_start
    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;->proceed(Lokhttp3/Request;)Lokhttp3/Response;
    move-result-object v0
    :try_end
    .catchall {:try_start .. :try_end} :failed
    invoke-virtual {v0}, Lokhttp3/Response;->code()I
    move-result v2
    invoke-static {v2}, Ljava/lang/String;->valueOf(I)Ljava/lang/String;
    move-result-object v2
    const-string v3, "WIRE_RESPONSE="
    invoke-virtual {v3, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v2
    invoke-static {v1, v2}, __DESC__->log(Ljava/lang/String;Ljava/lang/String;)V
    return-object v0
    :failed
    move-exception v0
    invoke-virtual {v0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;
    move-result-object v2
    invoke-virtual {v2}, Ljava/lang/Class;->getName()Ljava/lang/String;
    move-result-object v2
    const-string v3, "WIRE_EXCEPTION="
    invoke-virtual {v3, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v2
    invoke-static {v1, v2}, __DESC__->log(Ljava/lang/String;Ljava/lang/String;)V
    throw v0
    :passthrough
    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;->proceed(Lokhttp3/Request;)Lokhttp3/Response;
    move-result-object v0
    return-object v0
.end method

.method public static proceed(Lokhttp3/Interceptor$Chain;Lokhttp3/Request;)Lokhttp3/Response;
    .registers 7
    invoke-static {p1}, __DESC__->route(Lokhttp3/Request;)Ljava/lang/String;
    move-result-object v1
    :try_start
    invoke-interface {p0, p1}, Lokhttp3/Interceptor$Chain;->proceed(Lokhttp3/Request;)Lokhttp3/Response;
    move-result-object v0
    :try_end
    .catchall {:try_start .. :try_end} :failed
    return-object v0
    :failed
    move-exception v0
    if-eqz v1, :rethrow
    invoke-virtual {v0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;
    move-result-object v2
    invoke-virtual {v2}, Ljava/lang/Class;->getName()Ljava/lang/String;
    move-result-object v2
    const-string v3, "OUTER_EXCEPTION="
    invoke-virtual {v3, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v2
    invoke-static {v1, v2}, __DESC__->log(Ljava/lang/String;Ljava/lang/String;)V
    :rethrow
    throw v0
.end method
'''.replace("__DESC__", DESC)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--smali16", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    probe = a.smali16 / PROBE
    if probe.exists():
        raise RuntimeError("Wire trace already installed")
    changes = []
    base = a.smali16 / BASE
    old = base.read_text()
    anchor = ("    invoke-virtual {v0, v4}, Lokhttp3/OkHttpClient$Builder;"
              "->addInterceptor(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient$Builder;")
    if old.count(anchor) != 1:
        raise RuntimeError("Expected existing isolated login interceptor once")
    added = (f"\n\n    new-instance v4, {DESC}\n"
             f"    invoke-direct {{v4}}, {DESC}-><init>()V\n"
             "    invoke-virtual {v0, v4}, Lokhttp3/OkHttpClient$Builder;"
             "->addNetworkInterceptor(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient$Builder;")
    new = old.replace(anchor, anchor + added, 1)
    changes.append({"file": BASE, "before": hashlib.sha256(old.encode()).hexdigest(),
                    "after": hashlib.sha256(new.encode()).hexdigest()})
    base.write_text(new)
    outer = a.smali16 / OUTER
    old = outer.read_text()
    anchor = ("    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;"
              "->proceed(Lokhttp3/Request;)Lokhttp3/Response;")
    if old.count(anchor) != 1:
        raise RuntimeError("Expected model-probed outer passthrough exactly once")
    new = old.replace(anchor, f"    invoke-static {{p1, v0}}, {DESC}"
                      "->proceed(Lokhttp3/Interceptor$Chain;Lokhttp3/Request;)Lokhttp3/Response;", 1)
    changes.append({"file": OUTER, "before": hashlib.sha256(old.encode()).hexdigest(),
                    "after": hashlib.sha256(new.encode()).hexdigest()})
    outer.write_text(new)
    probe.write_text(source())
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({
        "mode": "UNCHANGED_ORIGINAL_MODEL_HTTP_WIRE_STATUS_AND_EXCEPTION_CLASSES",
        "changes": changes,
        "request_headers_body_urls_response_and_auth_decisions_unchanged": True,
        "sensitive_values_logged": False,
        "all_original_retry_and_redirect_behavior_preserved": True,
    }, indent=2))
    print("ORIGINAL_MODEL_NETWORK_STATUS_AND_OUTER_EXCEPTION_TRACE_INSTALLED=YES")


if __name__ == "__main__":
    main()
