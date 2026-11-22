#!/usr/bin/env python3
"""Read-only recovered DEX audit: recording stop, finalization, persistence and UI list.
No APK changes, no account data, no invented method names."""
import argparse, hashlib, json, re, subprocess, zipfile
from pathlib import Path
P=argparse.ArgumentParser()
P.add_argument('--main',type=Path,required=True)
P.add_argument('--recorder',type=Path,required=True)
P.add_argument('--baksmali',type=Path,required=True)
P.add_argument('--out',type=Path,required=True)
a=P.parse_args();a.out.mkdir(parents=True,exist_ok=True)
METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
CALL=re.compile(r'^\s*invoke-\S+\s+\{[^}]*\},\s*(L[^;]+;)->([^\s(]+)(\([^)]*\)\S+)')
CLASS=re.compile(r'^\.class [^\n]*(L[^;]+;)',re.M)
SCOPE=('Lcom/lguplus/aicallagent/','Lcom/lguplus/callrecorder/','Lcom/lguplus/aicallagentaidl/')
SEED=re.compile(r'stopRecord|finishRecord|completeRecord|saveRecord|onCompleted|onStopped|onStarted|onError|startRecording|switchRecord|recordFile|recordingFile|deleteRecord|recordingList|recordList|callRecordList|CallRecord.*(?:Dao|Entity|Database|Screen|ViewModel|Provider|Repository)|RecordFile|RecordingFile',re.I)
FILE=re.compile(r'Ljava/io/(?:File|FileOutputStream|RandomAccessFile|OutputStream|BufferedOutputStream);->(?:<init>|createNewFile|mkdirs?|renameTo|delete|exists|length|close|flush|write|getAbsolutePath|getPath|listFiles)|Landroid/media/(?:MediaRecorder|MediaMuxer|MediaCodec);->(?:setOutputFile|start|stop|release|<init>|writeSampleData|signalEndOfInputStream)|Landroid/content/ContentResolver;->(?:insert|update|query|openOutputStream|openFileDescriptor|delete|notifyChange)|Landroid/database/sqlite/[^;]+;->(?:insert|update|query|execSQL)|Landroid/content/Context;->(?:getFilesDir|getExternalFilesDir|getDatabasePath|getCacheDir)|Landroid/os/Environment;->|Landroidx/room/[^;]+;->(?:insert|query|execute|beginTransaction|endTransaction|setTransactionSuccessful)|Landroid/system/Os;->(?:rename|fsync)|Ljava/nio/file/Files;->(?:move|createFile|write)',re.I)
NAME=re.compile(r'Record|Audio|CallHistory|CallLog|Media|File|Provider|Storage|Database',re.I)
all_methods={}; dex_inventory=[]
def collect(role, apk):
    with zipfile.ZipFile(apk) as z:
        for n in z.namelist():
            if not re.fullmatch(r'classes\d*\.dex',n):continue
            data=z.read(n)
            if not any(x.encode() in data for x in SCOPE):continue
            base=a.out/'work'/role/n; base.mkdir(parents=True,exist_ok=True)
            d=base/'input.dex';d.write_bytes(data)
            listing=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(d)],text=True)
            owned=[x for x in listing.splitlines() if x.startswith(SCOPE)]
            if not owned:continue
            subprocess.run(['java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(base/'smali'),str(d)],check=True)
            dex_inventory.append(dict(role=role,dex=n,sha256=hashlib.sha256(data).hexdigest(),owned_classes=len(owned)))
            for c in owned:
                f=base/'smali'/(c[1:-1]+'.smali')
                if not f.exists():continue
                for m in METHOD.finditer(f.read_text(errors='replace')):
                    b=m.group(); h=b.splitlines()[0]; sig=h.split()[-1]
                    if '(' not in sig:continue
                    calls=[]
                    for i,line in enumerate(b.splitlines(),1):
                        k=CALL.match(line)
                        if k:
                            owner,fn,desc=k.groups()
                            calls.append(dict(line=i,target=owner+'->'+fn+desc,opcode=line.strip().split()[0],file_boundary=bool(FILE.search(line))))
                    key=(role,c+'->'+sig)
                    all_methods[key]=dict(role=role,dex=n,cls=c,signature=sig,body=b,calls=calls,native=' native ' in h)
    print('AUDIT_APK',role,hashlib.sha256(apk.read_bytes()).hexdigest(),flush=True)
collect('main',a.main);collect('recorder',a.recorder)
seeds={k for k,v in all_methods.items() if SEED.search(v['cls']+'->'+v['signature']) or (NAME.search(v['cls']) and any(c['file_boundary'] for c in v['calls']))}
# Add exact internal callees and callers, preserving cross-process interfaces as named edges.
chosen=set(seeds)
for depth in range(2):
    nxt=set()
    for k,v in all_methods.items():
        if k in chosen:
            nxt.update((k[0],c['target']) for c in v['calls'] if (k[0],c['target']) in all_methods and NAME.search(c['target']))
        elif any((k[0],c['target']) in chosen for c in v['calls']) and NAME.search(v['cls']):
            nxt.add(k)
    chosen.update(nxt)
out=[];boundaries=[];native=[]
for k in sorted(chosen):
    v=all_methods[k]; row={x:y for x,y in v.items() if x!='body'}
    out.append(row)
    for e in v['calls']:
        if e['file_boundary']:boundaries.append(dict(role=v['role'],dex=v['dex'],method=k[1],**e))
    if v['native']:native.append(dict(role=v['role'],dex=v['dex'],method=k[1]))
(a.out/'method-graph.json').write_text(json.dumps(out,indent=2))
(a.out/'file-boundaries.json').write_text(json.dumps(boundaries,indent=2))
(a.out/'native-boundaries.json').write_text(json.dumps(native,indent=2))
(a.out/'dex-inventory.json').write_text(json.dumps(dex_inventory,indent=2))
# Exact method bodies for the audit, not a synthetic reconstruction.
with (a.out/'original-methods.smali.txt').open('w') as f:
    for k in sorted(chosen):
        v=all_methods[k]
        f.write('\n### '+v['role']+' '+v['dex']+' '+k[1]+'\n'+v['body']+'\n')
print('AUDIT_METHODS',len(out),'FILE_BOUNDARIES',len(boundaries),'NATIVE_BOUNDARIES',len(native),flush=True)
for v in out:
    if re.search(r'stopRecord|onCompleted|saveRecord|finishRecord|recordFile|recordingFile|Record.*Dao',v['signature']+' '+v['cls'],re.I) and (v['calls'] or v['native']):
        print('EXACT_METHOD',v['role'],v['dex'],v['cls']+'->'+v['signature'],flush=True)
        for c in v['calls']:
            if c['file_boundary'] or SEED.search(c['target']):
                print('  EDGE',c['line'],c['target'],flush=True)
for e in boundaries:
    print('FILE_BOUNDARY',e['role'],e['dex'],e['method'],e['line'],e['target'],flush=True)
