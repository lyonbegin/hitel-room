#!/usr/bin/env python3
"""Minimal IXIO main APK patch: observe original successful FileUnzipWorker
and asynchronously copy verified STT model files to MediaStore Downloads.
No changes to the downloader/unzip code, app sign-in, recorder, or STT.
"""
import argparse,copy,hashlib,json,re,subprocess,zipfile
from pathlib import Path

p=argparse.ArgumentParser()
for k in ("apk","work","baksmali","smali","new_dex","out","report"):
    p.add_argument("--"+k,required=True,type=Path)
a=p.parse_args()
a.work.mkdir(parents=True,exist_ok=True)
TARGET="classes20.dex"
CLASS="com/lguplus/aicallagent/data/worker/FileUnzipWorker.smali"
DESCRIPTOR="Lcom/lguplus/aicallagent/hitelqa/ModelZipExporter;"
ORIGINAL_SUCCESS="    invoke-static {}, Lcom/lguplus/aicallagent/hitelqa/FlowTraceShard18;->s3666()V\n\n    :try_start_be"
PATCH="""    invoke-static {}, Lcom/lguplus/aicallagent/hitelqa/FlowTraceShard18;->s3666()V

    # Save already-completed IXIO models to Android Downloads without changing
    # the original unzip result or blocking the WorkManager completion.
    :try_start_hitel_model_export
    invoke-virtual {v1}, Landroidx/work/ListenableWorker;->getApplicationContext()Landroid/content/Context;
    move-result-object v5
    invoke-static {v5}, Lcom/lguplus/aicallagent/hitelqa/ModelZipExporter;->afterOriginalUnzipSuccess(Landroid/content/Context;)V
    :try_end_hitel_model_export
    .catch Ljava/lang/Throwable; {:try_start_hitel_model_export .. :try_end_hitel_model_export} :catch_hitel_model_export
    goto :hitel_model_export_done

    :catch_hitel_model_export
    move-exception v5
    const-string v4, "IXIO_MODEL_EXPORT"
    const-string v3, "EXPORT_HOOK_FAILED_BUT_ORIGINAL_UNZIP_SUCCESS_PRESERVED"
    invoke-static {v4, v3}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I

    :hitel_model_export_done
    :try_start_be"""

with zipfile.ZipFile(a.apk) as z:
    allfiles=z.namelist()
    if TARGET not in allfiles:raise RuntimeError("Required classes20.dex not found")
    dexes=sorted(int(m.group(1) or "1") for n in allfiles
                if (m:=re.fullmatch(r"classes([0-9]*)\.dex",n)))
    expected_new="classes%d.dex"%(dexes[-1]+1)
    if expected_new in allfiles:raise RuntimeError("New dex slot unexpectedly occupied")
    original_dex=z.read(TARGET)
    src_dex=a.work/TARGET;src_dex.write_bytes(original_dex)
    smali=a.work/"smali20"
    subprocess.run(["java","-Xmx4g","-jar",str(a.baksmali),
        "d","--api","34","--jobs","3","-o",str(smali),str(src_dex)],check=True)
    target=smali/CLASS
    orig=target.read_text()
    matches=list(re.finditer(r"(?ms)^\.method public doWork\(Lkotlin/coroutines/Continuation;\)Ljava/lang/Object;\n.*?^\.end method$",orig))
    if len(matches)!=1:raise RuntimeError("Expected one exact FileUnzipWorker.doWork, found %d"%len(matches))
    m=matches[0];method=m.group(0)
    if ".registers 21" not in method:raise RuntimeError("Unexpected Worker register layout")
    if method.count(ORIGINAL_SUCCESS)!=1:raise RuntimeError("Expected one original WORKER_SUCCESS marker; got %d"%method.count(ORIGINAL_SUCCESS))
    if "move-object/from16 v1, p0" not in method:raise RuntimeError("Worker Context source not verified")
    modified=method.replace(ORIGINAL_SUCCESS,PATCH,1)
    assert modified.count("->afterOriginalUnzipSuccess(Landroid/content/Context;)V")==1
    assert modified.count("Landroidx/work/ListenableWorker$Result;->success()")==1
    assert modified.count("Landroidx/work/ListenableWorker$Result;->failure()")==2
    assert modified.replace(PATCH,ORIGINAL_SUCCESS)==method
    patched=orig[:m.start()]+modified+orig[m.end():]
    target.write_text(patched)
    outputdex=a.work/"classes20-patched.dex"
    subprocess.run(["java","-Xmx4g","-jar",str(a.smali),
        "a","--api","34","--jobs","3","-o",str(outputdex),str(smali)],check=True)
    newdex=a.new_dex.read_bytes()
    if not newdex.startswith(b"dex\n"):raise RuntimeError("Exporter is not a DEX file")
    with zipfile.ZipFile(a.out,"w") as out:
        for entry in z.infolist():
            if re.fullmatch(r"META-INF/.*\.(?:RSA|EC|DSA|SF|MF)",entry.filename,re.I):continue
            out.writestr(copy.copy(entry),
              outputdex.read_bytes() if entry.filename==TARGET else z.read(entry.filename))
        out.writestr(expected_new,newdex,compress_type=zipfile.ZIP_DEFLATED)
    with zipfile.ZipFile(a.out) as built:
        unchanged=[n for n in allfiles if n in built.namelist() and n!=TARGET
                   and not n.startswith("META-INF/")]
        assert all(z.read(n)==built.read(n) for n in unchanged)
        assert built.read(expected_new)==newdex
    report={
      "baseline_sha256":hashlib.sha256(a.apk.read_bytes()).hexdigest(),
      "patched_method":"FileUnzipWorker.doWork(Continuation)",
      "insert_at":"original unzip success before Result.success()",
      "original_success_and_failure_paths_unchanged":True,
      "original_unzip_call_and_model_repository_unchanged":True,
      "all_non_target_apk_entries_byte_identical":True,
      "non_target_entries":len(unchanged),
      "added_only_helper_dex":expected_new,
      "export_destination":"Downloads/IXIO_Original_STT/IXIO_STT_Original_4.0.4.zip",
      "worker_dex_original_sha256":hashlib.sha256(original_dex).hexdigest(),
      "worker_dex_modified_sha256":hashlib.sha256(outputdex.read_bytes()).hexdigest(),
      "helper_dex_sha256":hashlib.sha256(newdex).hexdigest()
    }
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,indent=2))
    print("IXIO_ORIGINAL_MODEL_UNZIP_SUCCESS_EXPORT_HOOK_PATCHED",flush=True)
    print(json.dumps(report,indent=2),flush=True)
