#!/usr/bin/env python3
"""Test-only: add clear/copy diagnostics button and trace original permission flow.

Keeps native model, PCM, call, recorder, authentication and return-value logic intact.
"""
from __future__ import annotations
import argparse,hashlib,json,re,shutil
from pathlib import Path

PANEL="Lcom/lguplus/aicallagent/hitelqa/DiagHooks;"
TRACE="Lcom/lguplus/aicallagent/hitelqa/DiagTrace;"
METHOD=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")

def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def patch(file,selector,apply,changes):
    src=file.read_text()
    methods=[m for m in METHOD.finditer(src) if selector(m.group().splitlines()[0])]
    if len(methods)!=1:raise RuntimeError(f"{file.name}: expected one matching method, found {len(methods)}")
    m=methods[0];old=m.group();new=apply(old)
    if old==new or old.splitlines()[0]!=new.splitlines()[0]:raise RuntimeError("bad patch "+file.name)
    file.write_text(src[:m.start()]+new+src[m.end():])
    changes.append({"file":file.name,"method":old.splitlines()[0],"before":sha(old),"after":sha(new)})
    print("QA_LOG_HOOK",file.name,old.splitlines()[0],flush=True)
def named(name):return lambda header:bool(re.search(r"\b"+re.escape(name)+r"\(",header))

def main():
    ap=argparse.ArgumentParser()
    for n in (15,16,18):ap.add_argument("--smali"+str(n),type=Path,required=True)
    ap.add_argument("--diagnostic-smali",type=Path,required=True)
    ap.add_argument("--report",type=Path,required=True)
    a=ap.parse_args()
    roots={n:getattr(a,"smali"+str(n)) for n in (15,16,18)}
    changes=[]
    added=list(a.diagnostic_smali.rglob("*.smali"))
    assert len(added)>=3,"compiled diagnostic classes missing"
    for f in added:
        rel=f.relative_to(a.diagnostic_smali)
        if not (str(rel).startswith("com/lguplus/aicallagent/hitelqa/")
                or str(rel).startswith("com/android/tools/r8/annotations/")):
            raise RuntimeError("unexpected diagnostic D8 helper class "+str(rel))
        target=roots[18]/rel
        if target.exists():raise RuntimeError("QA class exists in original "+str(rel))
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(f,target)
    print("DIAGNOSTIC_CLASSES_MERGED",len(added))

    apps=[p for root in roots.values() for p in root.rglob("IXIApplication.smali")
          if str(p.relative_to(root)).startswith("com/lguplus/aicallagent/")]
    if len(apps)!=1:raise RuntimeError("IXIApplication search count "+str(len(apps)))
    def register(b):
        ms=list(re.finditer(r"(?m)^    invoke-super(?:/range)? \{[^\n]*\}, L[^\n]+;->onCreate\(\)V$",b))
        if len(ms)!=1:raise RuntimeError("original Application super onCreate count "+str(len(ms)))
        m=ms[0]
        return b[:m.end()]+"\n    invoke-static/range {p0 .. p0}, "+PANEL+"->install(Landroid/app/Application;)V"+b[m.end():]
    patch(apps[0],named("onCreate"),register,changes)

    repo=roots[18]/"com/lguplus/aicallagent/data/init/permission/RequirePermissionRepository.smali"
    def repo_write(b):
        before="    iget-object p0, p0, Lcom/lguplus/aicallagent/data/init/permission/RequirePermissionRepository;->_requiredPermissionState:Lkotlinx/coroutines/flow/MutableStateFlow;"
        if b.count(before)!=1:raise RuntimeError("repository state setter layout changed")
        return b.replace(before,"    invoke-static/range {p0 .. p1}, "+TRACE+"->repoWrite(Ljava/lang/Object;Z)V\n"+before,1)
    patch(repo,named("setRequiredPermissionState"),repo_write,changes)

    def repo_check(b):
        pattern=re.compile(
          r"invoke-virtual \{v0, v1\}, Lcom/pineone/permission/PermissionUtil;->isRequirePermissionGranted\(Landroid/content/Context;\)Z\s*\n\s*move-result (?P<reg>[vp]\d+)")
        ms=list(pattern.finditer(b))
        if len(ms)!=1:raise RuntimeError("native permission check count "+str(len(ms)))
        m=ms[0]
        return b[:m.end()]+"\n    invoke-static {p0, "+m.group('reg')+"}, "+TRACE+"->repoCheck(Ljava/lang/Object;Z)V"+b[m.end():]
    patch(repo,named("isRequirePermissionGranted"),repo_check,changes)

    vm=roots[18]/"com/lguplus/aicallagent/incall/call/ui/CallViewModel.smali"
    def vm_init(b):
        pat=re.compile(r"invoke-virtual \{[vp]\d+\}, Lcom/lguplus/aicallagent/data/init/permission/RequirePermissionRepository;->isRequirePermissionGranted\(\)Z\s*\n\s*move-result (?P<reg>[vp]\d+)")
        ms=list(pat.finditer(b))
        if len(ms)!=1:raise RuntimeError("call VM initial permission read count "+str(len(ms)))
        if "iput-object v0, v15, Lcom/lguplus/aicallagent/incall/call/ui/CallViewModel;" not in b:
            raise RuntimeError("original CallViewModel this register changed")
        m=ms[0]
        return b[:m.end()]+"\n    invoke-static {v15, "+m.group('reg')+"}, "+TRACE+"->viewModelInitial(Ljava/lang/Object;Z)V"+b[m.end():]
    patch(vm,lambda h:" constructor <init>(" in h,vm_init,changes)

    flow=roots[18]/"com/lguplus/aicallagent/incall/call/ui/CallViewModel$permissionFlow$1.smali"
    def flow_emission(b):
        pat=re.compile(r"(?m)^    iget-boolean (?P<reg>[vp]\d+), p0, Lcom/lguplus/aicallagent/incall/call/ui/CallViewModel\$permissionFlow\$1;->Z\$0:Z$")
        ms=list(pat.finditer(b))
        if len(ms)!=1:raise RuntimeError("original Flow emission count "+str(len(ms)))
        m=ms[0]
        return b[:m.end()]+"\n    invoke-static {p0, "+m.group('reg')+"}, "+TRACE+"->flowEmission(Ljava/lang/Object;Z)V"+b[m.end():]
    patch(flow,named("invokeSuspend"),flow_emission,changes)

    screens=list(roots[18].rglob("ErrorStateScreenKt.smali"))
    if len(screens)!=1:raise RuntimeError("original permission error screen count "+str(len(screens)))
    def screen_state(b):
        pat=re.compile(r"invoke-virtual \{[vp]\d+\}, Lcom/lguplus/aicallagent/model/call/AppStatus;->getPermissionGranted\(\)Z\s*\n\s*move-result (?P<reg>[vp]\d+)")
        ms=list(pat.finditer(b))
        if len(ms)!=1:raise RuntimeError("screen permission read count "+str(len(ms)))
        m=ms[0];v=m.group('reg')
        return b[:m.end()]+"\n    invoke-static/range {"+v+" .. "+v+"}, "+TRACE+"->screenState(Z)V"+b[m.end():]
    patch(screens[0],named("ErrorStateScreen"),screen_state,changes)

    captures=[
      (18,"HitelOriginalRecordStartTrace.smali"),
      (18,"HitelOriginalPermissionTrace.smali"),
      (16,"HitelOriginalProvisioningProbe.smali"),
      (15,"HitelOriginalModelProbe.smali"),
      (16,"HitelTokenGateTrace.smali"),
    ]
    old="invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I"
    replacement="invoke-static {v0, v1}, "+TRACE+"->fixedTag(Ljava/lang/String;Ljava/lang/String;)V"
    for n,name in captures:
        found=list(roots[n].rglob(name))
        if len(found)!=1:
            print("OPTIONAL_PROBE_UNAVAILABLE",name,len(found));continue
        f=found[0];src=f.read_text()
        if old not in src:
            print("OPTIONAL_PROBE_NO_MATCH",name);continue
        updated=src.replace(old,replacement)
        f.write_text(updated)
        changes.append({"file":name,"mode":"persist fixed markers", "before":sha(src),"after":sha(updated)})
        print("PROBE_CAPTURE_ENABLED",name,flush=True)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
        "mode":"ORIGINAL_IXIO_NATIVE_WITH_DIAGNOSTIC_LOG_BUTTONS",
        "diagnostic_smali_classes":len(added),
        "changes":changes,
        "original_permission_outcomes_changed":False,
        "original_pcm_recording_stt_model_methods_changed":False,
        "event_labels_only_no_credentials":True
    },indent=2,ensure_ascii=False))
    print("IXIO_IN_APP_LOG_CLEAR_COPY_AND_PERMISSION_FLOW_TRACE_READY=YES",flush=True)

if __name__=="__main__":
    main()
