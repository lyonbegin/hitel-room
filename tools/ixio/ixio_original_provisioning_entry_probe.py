#!/usr/bin/env python3
"""Invoke the existing local DEK provisioning once in an isolated QA build.

The Pages login fixture skips the original CTN encryption callers. Start the
original ensureProvisioned method after its fully initialized manager is
constructed, and record success or exception class names. No keys, ciphertext,
certificates, crypto decisions, model or recording algorithms are substituted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = "com/lguplus/aicallagent/util/crypto/"
MANAGER = ROOT + "ProvisioningManager.smali"
PROBE = ROOT + "HitelOriginalProvisioningProbe.smali"
DESC = "L" + PROBE[:-6] + ";"
MDESC = "L" + MANAGER[:-6] + ";"


def source() -> str:
    return r'''.class public final __DESC__
.super Ljava/lang/Object;
.implements Ljava/lang/Runnable;
.implements Lkotlin/jvm/functions/Function2;

.field private final manager:__MANAGER__

.method public constructor <init>(__MANAGER__)V
    .registers 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, __DESC__->manager:__MANAGER__
    return-void
.end method

.method public static start(__MANAGER__)V
    .registers 3
    new-instance v0, __DESC__
    invoke-direct {v0, p0}, __DESC__-><init>(__MANAGER__)V
    new-instance v1, Ljava/lang/Thread;
    invoke-direct {v1, v0}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V
    invoke-virtual {v1}, Ljava/lang/Thread;->start()V
    return-void
.end method

.method private static log(Ljava/lang/String;)V
    .registers 2
    const-string v0, "IXIO_ORIGINAL_PROVISIONING"
    invoke-static {v0, p0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    return-void
.end method

.method private static failure(Ljava/lang/Throwable;)V
    .registers 4
    const-string v0, "ORIGINAL_ENSURE_PROVISIONED_FAILED"
    invoke-static {v0}, __DESC__->log(Ljava/lang/String;)V
    const/4 v0, 0x0
    :next
    if-eqz p0, :done
    const/4 v1, 0x4
    if-ge v0, v1, :done
    invoke-virtual {p0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;
    move-result-object v1
    invoke-virtual {v1}, Ljava/lang/Class;->getName()Ljava/lang/String;
    move-result-object v1
    invoke-static {v1}, __DESC__->log(Ljava/lang/String;)V
    invoke-static {p0}, __DESC__->trace(Ljava/lang/Throwable;)V
    invoke-virtual {p0}, Ljava/lang/Throwable;->getCause()Ljava/lang/Throwable;
    move-result-object p0
    add-int/lit8 v0, v0, 0x1
    goto :next
    :done
    return-void
.end method

.method private static trace(Ljava/lang/Throwable;)V
    .registers 5
    invoke-virtual {p0}, Ljava/lang/Throwable;->getStackTrace()[Ljava/lang/StackTraceElement;
    move-result-object v0
    array-length v1, v0
    const/4 v2, 0x0
    :next
    if-ge v2, v1, :done
    const/4 v3, 0x6
    if-ge v2, v3, :done
    aget-object v3, v0, v2
    invoke-virtual {v3}, Ljava/lang/StackTraceElement;->toString()Ljava/lang/String;
    move-result-object v3
    invoke-static {v3}, __DESC__->log(Ljava/lang/String;)V
    add-int/lit8 v2, v2, 0x1
    goto :next
    :done
    return-void
.end method

.method public run()V
    .registers 4
    const-string v0, "ORIGINAL_ENSURE_PROVISIONED_START"
    invoke-static {v0}, __DESC__->log(Ljava/lang/String;)V
    :try_start
    sget-object v0, Lkotlin/coroutines/EmptyCoroutineContext;->INSTANCE:Lkotlin/coroutines/EmptyCoroutineContext;
    invoke-static {v0, p0}, Lkotlinx/coroutines/BuildersKt;->runBlocking(Lkotlin/coroutines/CoroutineContext;Lkotlin/jvm/functions/Function2;)Ljava/lang/Object;
    move-result-object v0
    invoke-static {v0}, Lkotlin/Result;->exceptionOrNull-impl(Ljava/lang/Object;)Ljava/lang/Throwable;
    move-result-object v1
    if-nez v1, :failed_result
    const-string v0, "ORIGINAL_ENSURE_PROVISIONED_SUCCESS"
    invoke-static {v0}, __DESC__->log(Ljava/lang/String;)V
    :try_end
    .catchall {:try_start .. :try_end} :failed_throw
    return-void
    :failed_result
    invoke-static {v1}, __DESC__->failure(Ljava/lang/Throwable;)V
    return-void
    :failed_throw
    move-exception v0
    invoke-static {v0}, __DESC__->failure(Ljava/lang/Throwable;)V
    return-void
.end method

.method public invoke(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
    .registers 4
    check-cast p2, Lkotlin/coroutines/Continuation;
    iget-object v0, p0, __DESC__->manager:__MANAGER__
    invoke-virtual {v0, p2}, __MANAGER__->ensureProvisioned-IoAF18A(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
    move-result-object v0
    return-object v0
.end method
'''.replace("__DESC__", DESC).replace("__MANAGER__", MDESC)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smali16", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    a = parser.parse_args()
    manager = a.smali16 / MANAGER
    probe = a.smali16 / PROBE
    old = manager.read_text()
    hits = list(re.finditer(r"(?ms)^\.method public constructor <init>\([^\n]*\n.*?^\.end method$", old))
    if len(hits) != 1 or probe.exists():
        raise RuntimeError("Expected one pristine original ProvisioningManager constructor")
    m = hits[0]
    body = m.group()
    if body.count("    return-void") != 1:
        raise RuntimeError("Unexpected original constructor return layout")
    newbody = body.replace("    return-void",
                          f"    invoke-static/range {{p0 .. p0}}, {DESC}->start({MDESC})V\n"
                          "    return-void", 1)
    manager.write_text(old[:m.start()] + newbody + old[m.end():])
    probe.write_text(source())
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({
        "mode": "INVOKE_ORIGINAL_LOCAL_ENSURE_PROVISIONED_ONCE_PER_MANAGER",
        "original_constructor_sha256": hashlib.sha256(body.encode()).hexdigest(),
        "test_constructor_sha256": hashlib.sha256(newbody.encode()).hexdigest(),
        "original_crypto_method_bodies_unchanged": True,
        "new_keys_ciphertexts_or_original_certificate_values_supplied": False,
        "diagnostic_thread_catches_failure_without_hiding_original_call_failure": True,
        "test_only": True,
    }, indent=2))
    print("ORIGINAL_LOCAL_PROVISIONING_ENTRY_CALL_INSTALLED=YES")


if __name__ == "__main__":
    main()
