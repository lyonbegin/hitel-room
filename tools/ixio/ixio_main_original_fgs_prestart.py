#!/usr/bin/env python3
"""Main-only QA: replay the ORIGINAL main-originated recorder foreground-service start when AIDL stays bound."""
import argparse,copy,hashlib,json,re,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser()
for k in ('apk','work','baksmali','smali','out','report'):p.add_argument('--'+k,required=True,type=Path)
a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.apk) as z:
    original=z.read('classes18.dex')
    in_dex=a.work/'classes18.dex';in_dex.write_bytes(original)
    smali_root=a.work/'smali18'
    subprocess.run(['java','-Xmx4g','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(smali_root),str(in_dex)],check=True)
    source_file=smali_root/'com/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy.smali'
    source=source_file.read_text()
    method_re=re.compile(r'(?ms)^\.method public startRecording\(Lcom/lguplus/aicallagent/model/call/CallDetails;ZZLkotlin/coroutines/Continuation;\)Ljava/lang/Object;\n.*?^\.end method$')
    match=method_re.search(source)
    assert match is not None and len(method_re.findall(source))==1,'startRecording target not unique'
    old=match.group(0)
    assert old.count('.registers 5')==1
    anchor=('    .line 148\n'
      '    iget-object p0, p0, Lcom/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy;->callRecordingManager:Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;')
    assert old.count(anchor)==1
    assert source.count('->startForegroundServiceIfRequired(Landroid/content/Intent;)V')==1
    addon='''    .line 148
    iget-boolean v0, p0, Lcom/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy;->_isBound:Z
    if-eqz v0, :hitel_fgs_original_bind_path
    const-string v0, "IXIO_FGS_PRESTART_QA"
    const-string v1, "MAIN_ALREADY_BOUND_ORIGINAL_FGS_CALL_ENTER"
    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    invoke-direct {p0}, Lcom/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy;->createServiceIntent()Landroid/content/Intent;
    move-result-object v0
    invoke-direct {p0, v0}, Lcom/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy;->startForegroundServiceIfRequired(Landroid/content/Intent;)V
    const-string v0, "IXIO_FGS_PRESTART_QA"
    const-string v1, "MAIN_ALREADY_BOUND_ORIGINAL_FGS_CALL_RETURN"
    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    :hitel_fgs_original_bind_path
    iget-object p0, p0, Lcom/lguplus/aicallagent/incall/call/data/recording/AidlRecordingStrategy;->callRecordingManager:Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;'''
    new=old.replace('.registers 5','.registers 7',1).replace(anchor,addon,1)
    assert new.count('->startForegroundServiceIfRequired(Landroid/content/Intent;)V')==1
    assert new.count('->startRecord(Lcom/lguplus/aicallagent/model/call/CallDetails;ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;')==1
    source_new=source[:match.start()]+new+source[match.end():]
    assert source_new.replace(new,old,1)==source
    source_file.write_text(source_new)
    patched=a.work/'classes18-new.dex'
    subprocess.run(['java','-Xmx4g','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(patched),str(smali_root)],check=True)
    with zipfile.ZipFile(a.out,'w') as out:
        for e in z.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',e.filename,re.I):continue
            out.writestr(copy.copy(e),patched.read_bytes() if e.filename=='classes18.dex' else z.read(e.filename))
    with zipfile.ZipFile(a.out) as out:
        unchanged=[n for n in z.namelist() if n in out.namelist() and n!='classes18.dex' and not n.startswith('META-INF/')]
        assert all(out.read(n)==z.read(n) for n in unchanged)
    report={'patched_main_method':'AidlRecordingStrategy.startRecording','original_initial_bind_unchanged':True,'replay_original_fgs_helper_when_already_bound':True,'original_startRecord_call_unchanged':True,'original_other_files_identical':True,'other_zip_entries':len(unchanged),'original_dex_sha256':hashlib.sha256(original).hexdigest(),'patched_dex_sha256':hashlib.sha256(patched.read_bytes()).hexdigest()}
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,indent=2))
    print('MAIN_REPLAY_ORIGINAL_FOREGROUND_SERVICE_ON_BOUND_RECORDING=PATCHED')
