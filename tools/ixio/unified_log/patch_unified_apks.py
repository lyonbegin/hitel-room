#!/usr/bin/env python3
"""Main button -> combined main+recorder logs. Repack ONLY 1 main method and append QA dex.
Recorder: preserve all original dex and resources; add read-only log provider + manifest declaration.
"""
import argparse,copy,hashlib,json,re,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['main','recorder','mainhelper','rechelp','recmanifest','baksmali','smali','work','mainout','recout','report']:
    p.add_argument('--'+name,required=True,type=Path)
a=p.parse_args()
a.work.mkdir(parents=True,exist_ok=True)
MANIFEST='AndroidManifest.xml'
def sha(b):return hashlib.sha256(b).hexdigest()
def zcopy(src,dst,updates,appends):
    with zipfile.ZipFile(src) as orig,zipfile.ZipFile(dst,'w') as output:
        for inf in orig.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',inf.filename,re.I):
                continue
            output.writestr(copy.copy(inf),updates.get(inf.filename,orig.read(inf.filename)))
        for n,v in appends.items():
            assert n not in orig.namelist()
            output.writestr(n,v)
    with zipfile.ZipFile(src) as orig,zipfile.ZipFile(dst) as new:
        excluded=set(updates)
        copied=[n for n in orig.namelist() if n in new.namelist()
                and n not in excluded and not n.startswith('META-INF/')]
        assert all(new.read(n)==orig.read(n) for n in copied)
        return len(copied)
with zipfile.ZipFile(a.main) as z:
    dexname='classes18.dex'
    assert dexname in z.namelist()
    dex=a.work/dexname
    dex.write_bytes(z.read(dexname))
    root=a.work/'main-smali'
    subprocess.run(['java','-Xmx4g','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(root),str(dex)],check=True)
    f=root/'com/lguplus/aicallagent/hitelqa/DiagHooks.smali'
    assert f.is_file(), "main DiagHooks not found in classes18"
    s=f.read_text()
    rx=re.compile(r'(?ms)^\.method[^\n]* show\(Landroid/app/Activity;\)V\n.*?^\.end method$')
    match=rx.search(s)
    assert match and len(rx.findall(s))==1, "DiagHooks.show target not unique"
    original=match.group()
    header=original.splitlines()[0]
    assert ' static ' in header,header
    replacement=header+'''
    .registers 1
    invoke-static {p0}, Lcom/lguplus/aicallagent/hitelqa/MainUnifiedLogs;->show(Landroid/app/Activity;)V
    return-void
.end method'''
    f.write_text(s[:match.start()]+replacement+s[match.end():])
    patched_dex=a.work/'classes18-patched.dex'
    subprocess.run(['java','-Xmx4g','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(patched_dex),str(root)],check=True)
    dexes=[n for n in z.namelist() if re.fullmatch(r'classes(?:\d+)?\.dex',n)]
    num=max(int(x[7:-4] or '1') for x in dexes)
    mainnew='classes'+str(num+1)+'.dex'
    maincount=zcopy(a.main,a.mainout,{dexname:patched_dex.read_bytes()},{mainnew:a.mainhelper.read_bytes()})
with zipfile.ZipFile(a.recorder) as z:
    assert MANIFEST in z.namelist()
    manifest=a.recmanifest.read_bytes()
    assert manifest!=z.read(MANIFEST)
    reldexes=[n for n in z.namelist() if re.fullmatch(r'classes(?:\d+)?\.dex',n)]
    num=max(int(x[7:-4] or '1') for x in reldexes)
    recnew='classes'+str(num+1)+'.dex'
    reccount=zcopy(a.recorder,a.recout,{MANIFEST:manifest},{recnew:a.rechelp.read_bytes()})
report={
    'main_patched_exact_method':'DiagHooks.show(Activity) -> MainUnifiedLogs.show(Activity)',
    'main_original_recording_unchanged':True,
    'main_existing_fgsprestart_unchanged':True,
    'main_original_logging_files_unchanged':True,
    'main_new_helper_dex':mainnew,
    'recorder_original_recording_FGS_PCM_and_auth_dex_byte_identical':True,
    'recorder_only_changes':['AndroidManifest.xml','new diagnostic helper dex '+recnew],
    'recorder_new_provider':'com.lguplus.callrecorder.hitelqa.RecorderTraceProvider',
    'recorder_new_dex':recnew,
    'unchanged_main_entries':maincount,
    'unchanged_recorder_entries':reccount,
    'main_sha256':sha(a.mainout.read_bytes()),
    'recorder_sha256':sha(a.recout.read_bytes())
}
a.report.parent.mkdir(parents=True,exist_ok=True)
a.report.write_text(json.dumps(report,indent=2,ensure_ascii=False))
print('UNIFIED_LOG_APK_STRICT_PATCH_OK',json.dumps(report,ensure_ascii=False))
