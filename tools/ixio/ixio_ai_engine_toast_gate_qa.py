#!/usr/bin/env python3
"""QA: public model catalog plus the exact VAS toast gate for local recording."""
from pathlib import Path
import argparse,hashlib,json,re

M=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
TARGET="com/lguplus/aicallagent/dip/domain/ai/usecase/UpdateAiModelUseCaseImpl.smali"
DESC="Lcom/lguplus/aicallagent/hitelqa/ModelCatalogQaTrace;"
def sha(s):return hashlib.sha256(s.encode("utf-8")).hexdigest()

def public_catalog(src):
    hits=[m for m in M.finditer(src) if " getAiModelInfoList-IoAF18A(" in m.group().splitlines()[0]]
    if len(hits)!=1:raise RuntimeError("Expected one model catalog selector")
    m=hits[0];old=m.group()
    before=("Lcom/lguplus/aicallagent/dip/domain/ai/repository/AiModelRepository;"
            "->fetchAiModelInfoAuthenticated-gIAlu-s(")
    after=before.replace("fetchAiModelInfoAuthenticated","fetchAiModelInfo")
    if old.count(before)!=1:raise RuntimeError("Authenticated model call not unique")
    new=old.replace(before,after,1)
    at=new.index(after)
    start=new.rfind("\n",0,at)+1
    new=new[:start]+"    invoke-static {}, "+DESC+"->publicCatalog()V\n"+new[start:]
    return src[:m.start()]+new+src[m.end():],{"method":old.splitlines()[0],"before":sha(old),"after":sha(new)}

def local_record_menu(src):
    needle=("    instance-of p1, p1, "
            "Lcom/lguplus/aicallagent/setting/viewmodel/ToolTipStatus$VasError;")
    if src.count(needle)!=1:raise RuntimeError("Expected exact VAS toast predicate")
    owner=re.search(r"(?m)^\.class[^\n]* (L[^;]+;)",src)
    if not owner:raise RuntimeError("Missing click handler class")
    extra=("\n    iget-object v1, p0, "+owner.group(1)+"->$destination:"
           "Lcom/lguplus/aicallagent/navigation/SettingDestination;\n"
           "    invoke-static {p1, v1}, "+DESC+"->blockingVasError("
           "ZLcom/lguplus/aicallagent/navigation/SettingDestination;)Z\n"
           "    move-result p1")
    if ".method public final invokeSuspend(Ljava/lang/Object;)Ljava/lang/Object;\n    .registers 4" not in src:
        raise RuntimeError("Original menu handler register shape changed")
    return src.replace(needle,needle+extra,1)

def helper_source():
    return f""".class public final {DESC}
.super Ljava/lang/Object;

.method public static publicCatalog()V
    .registers 2
    const-string v0, "IXIO_QA_GATE"
    const-string v1, "EXISTING_PUBLIC_MODEL_CATALOG_SELECTED"
    invoke-static {{v0, v1}}, Lcom/lguplus/aicallagent/hitelqa/DiagTrace;->fixedTag(Ljava/lang/String;Ljava/lang/String;)V
    return-void
.end method

.method public static blockingVasError(ZLcom/lguplus/aicallagent/navigation/SettingDestination;)Z
    .registers 4
    if-eqz p0, :original
    instance-of v0, p1, Lcom/lguplus/aicallagent/navigation/SettingDestination$CallRecord;
    if-eqz v0, :original
    const-string v0, "IXIO_QA_GATE"
    const-string v1, "LOCAL_RECORDING_SETTING_VAS_TOAST_GATE_SKIPPED"
    invoke-static {{v0, v1}}, Lcom/lguplus/aicallagent/hitelqa/DiagTrace;->fixedTag(Ljava/lang/String;Ljava/lang/String;)V
    const/4 p0, 0x0
    :original
    return p0
.end method
"""

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--smali16",type=Path,required=True)
    p.add_argument("--smali18",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    a=p.parse_args();changes=[]
    path=a.smali16/TARGET;old=path.read_text(encoding="utf-8")
    new,change=public_catalog(old);path.write_text(new,encoding="utf-8")
    change["file"]=TARGET;changes.append(change)
    handlers=[x for x in a.smali18.rglob("SettingScreenKt*.smali")
              if "->showVasErrorRetryToast()V" in x.read_text(encoding="utf-8")]
    if len(handlers)!=1:raise RuntimeError("Expected one original VAS toast click handler")
    handler=handlers[0];before=handler.read_text(encoding="utf-8")
    after=local_record_menu(before);handler.write_text(after,encoding="utf-8")
    changes.append({"file":str(handler.relative_to(a.smali18)),"before":sha(before),"after":sha(after)})
    helper=a.smali18/"com/lguplus/aicallagent/hitelqa/ModelCatalogQaTrace.smali"
    if helper.exists():raise RuntimeError("QA helper already present")
    helper.parent.mkdir(parents=True,exist_ok=True)
    helper.write_text(helper_source(),encoding="utf-8")
    wire=a.smali16/"com/lguplus/aicallagent/network/client/HitelModelWireTrace.smali"
    before=wire.read_text(encoding="utf-8")
    needle="invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I"
    replacement="invoke-static {v1, v0}, Lcom/lguplus/aicallagent/hitelqa/DiagTrace;->fixedTag(Ljava/lang/String;Ljava/lang/String;)V"
    if before.count(needle)!=1:raise RuntimeError("Unexpected wire log shape")
    after=before.replace(needle,replacement,1);wire.write_text(after,encoding="utf-8")
    changes.append({"file":str(wire.relative_to(a.smali16)),"before":sha(before),"after":sha(after)})
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
      "mode":"QA_PUBLIC_MODEL_CATALOG_AND_LOCAL_RECORDING_MENU_VAS_TOAST_GATE",
      "changes":changes,"local_record_menu_skips_only_vas_toast_predicate":True,
      "vendor_model_urls_and_server_responses_unchanged":True,
      "native_model_checks_download_workers_pcm_stt_unchanged":True,
      "fake_download_or_recording_success_flags":False
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print("QA_EXISTING_PUBLIC_MODEL_CATALOG_AND_LOCAL_RECORDING_MENU_GATE_PATCHED=YES",flush=True)

if __name__=="__main__":main()
