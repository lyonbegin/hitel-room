#!/usr/bin/env python3
"""Record actual original required permissions and their Android grant results."""
import argparse
import hashlib
import json
from pathlib import Path

TARGET="com/lguplus/aicallagent/data/init/permission/RequirePermissionRepository.smali"
PROBE="com/lguplus/aicallagent/data/init/permission/HitelOriginalPermissionTrace.smali"
DESC="L"+PROBE[:-6]+";"


def source():
    return r'''.class public final __DESC__
.super Ljava/lang/Object;

.method public static trace(Landroid/content/Context;Z)V
    .registers 8
    invoke-static {p1}, Ljava/lang/String;->valueOf(Z)Ljava/lang/String;
    move-result-object v0
    const-string v1, "IXIO_REQUIRED_PERMISSION_RESULT"
    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    invoke-virtual {p0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;
    move-result-object v0
    const-string v1, "IXIO_REQUIRED_PERMISSION_CONTEXT"
    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    sget-object v0, Lcom/pineone/permission/PermissionUtil;->INSTANCE:Lcom/pineone/permission/PermissionUtil;
    invoke-virtual {v0, p0}, Lcom/pineone/permission/PermissionUtil;->getRequirePermissionList(Landroid/content/Context;)Ljava/util/List;
    move-result-object v0
    invoke-interface {v0}, Ljava/util/List;->iterator()Ljava/util/Iterator;
    move-result-object v0
    :next
    invoke-interface {v0}, Ljava/util/Iterator;->hasNext()Z
    move-result v1
    if-eqz v1, :done
    invoke-interface {v0}, Ljava/util/Iterator;->next()Ljava/lang/Object;
    move-result-object v1
    check-cast v1, Ljava/lang/String;
    invoke-static {p0, v1}, Landroidx/core/content/ContextCompat;->checkSelfPermission(Landroid/content/Context;Ljava/lang/String;)I
    move-result v2
    invoke-static {v2}, Ljava/lang/String;->valueOf(I)Ljava/lang/String;
    move-result-object v2
    const-string v3, "="
    invoke-virtual {v1, v3}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v1
    invoke-virtual {v1, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v1
    const-string v2, "IXIO_REQUIRED_PERMISSION_ITEM"
    invoke-static {v2, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    goto :next
    :done
    return-void
.end method
'''.replace("__DESC__",DESC)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--smali18",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    a=p.parse_args();target=a.smali18/TARGET;probe=a.smali18/PROBE
    old=target.read_text()
    anchor=("    invoke-virtual {v0, v1}, Lcom/pineone/permission/PermissionUtil;"
            "->isRequirePermissionGranted(Landroid/content/Context;)Z\n\n"
            "    move-result v0")
    if old.count(anchor)!=1 or probe.exists():
        raise RuntimeError("Unexpected original required-permission check")
    new=old.replace(anchor,anchor+f"\n    invoke-static {{v1, v0}}, {DESC}->trace(Landroid/content/Context;Z)V",1)
    target.write_text(new);probe.write_text(source())
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({"mode":"ORIGINAL_REQUIRED_PERMISSIONS_AND_ACTUAL_CONTEXTCOMPAT_RESULTS_ONLY",
        "before":hashlib.sha256(old.encode()).hexdigest(),"after":hashlib.sha256(new.encode()).hexdigest(),
        "original_permission_results_and_control_flow_unchanged":True},indent=2))
    print("ORIGINAL_REQUIRED_PERMISSION_RESULT_TRACE_INSTALLED=YES")


if __name__=="__main__":main()
