#!/usr/bin/env python3
"""Targeted original file lifecycle probes; no control/permission changes."""
import argparse, copy, json, re, subprocess, zipfile
from pathlib import Path
import ixio_original_flow_trace as core
p=argparse.ArgumentParser()
for n in ('apk','work','baksmali','smali','helper','out','report'):p.add_argument('--'+n,type=Path,required=True)
p.add_argument('--role',choices=['main','recorder'],required=True)
a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
TARGETS={
'main':{
'CallRecordingManager':r'^(requestRecordStart|startRecord|stopRecord|finishRecordingStopped)$',
'CallRecordingManager$recordingCallback$1':r'^(onStarted|onCompleted|onError)$',
'CallRecordingManager$recordingCallback$1$onCompleted$1':r'^invokeSuspend$',
'CallRecordingManager$stopRecord$2':r'^invokeSuspend$',
'CallRecordingManager$startRecord$2':r'^invokeSuspend$',
'RecordRepository':r'^(switchRecord|getRecordingFilePathFromCache|saveRecordingFileToMediasStore|getCallMediaRecorder)$',
'RecordRepository$saveRecordingFileToMediasStore$2':r'^invokeSuspend$',
'RecordingFileRepositoryImpl':r'^query(AudioFiles|Files|FilesWithPatterns)$',
'CallRecordingService$stopRecording$2':r'^invokeSuspend$',
},
'recorder':{
'CallRecorder':r'^(startRecording|stopRecord|clearMediaRecorder)$',
'InCallService':r'^(handleStartRecording|handleStopRecording|processStopRecord)$',
'InCallService$binder$1':r'^(startRecording|stopRecording)$',
'CallRecordingRepositoryImpl':r'^(startRecording|stopRecording)$',
'RecordRepositoryImpl':r'^getRecordingFile(?:DescriptorFromUri|PathFromMediaStore)$',
'GetMediaRecorderUseCase':r'^execute$',
'CallRecordingService$binder$1':r'^(startRecording|stopRecording)$',
'RecordCallbackRepositoryImpl':r'^(notifyCompleted|stopRecordCallback)$',
}}
# use original class definitions, not method offset guesses
SCOPE='Lcom/lguplus/'+('aicallagent/' if a.role=='main' else 'callrecorder/')
DESC='Lcom/hitel/qa/StoragePoints;'
core.PROBE_CALL=re.compile(r'^invoke-static(?:/range)? \{[^\n]*\}, '+re.escape(DESC)+r'->s(\d+)\([^\n]*\)V$')
METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
CALLS=re.compile(r'->(?:startRecording|stopRecording|startRecord|stopRecord|switchRecord|onStarted|onCompleted|onError|notifyCompleted|saveRecordingFileToMediasStore|getRecordingFilePath(?:FromCache|FromMediaStore)?|getRecordingFileDescriptorFromUri|access\$getRecordingFilePath|access\$clearRecordingFilePathIfSame|requestRecordStart|finishRecordingStopped|queryAudioFiles|queryFiles|queryFilesWithPatterns|ordinal|prepare|setAudioSource|setOutputFile|setOutputFormat|setAudioEncoder|start|stop|release|close|flush|write|insert|update|delete|query|openOutputStream|openFileDescriptor|exists|length|createNewFile|getStatSize|getCount)\(',re.I)
PLATFORM=('Landroid/media/MediaRecorder;','Landroid/content/ContentResolver;','Ljava/io/','Landroid/os/ParcelFileDescriptor;','Landroid/database/Cursor;')
sites=[]; changed={}; found=set()
def run(*s):subprocess.run(s,check=True)
def probe(label,kind='',reg=None):
    sid=100000+len(sites);sites.append(dict(id=sid,label=label,kind=kind))
    if not kind:return f'    invoke-static {{}}, {DESC}->s{sid}()V\n'
    end=reg if kind!='J' else reg[0]+str(int(reg[1:])+1)
    return f'    invoke-static/range {{{reg} .. {end}}}, {DESC}->s{sid}({kind})V\n'
def kind(t):return 'Ljava/lang/Object;' if t.startswith(('L','[')) else 'I' if t in ('Z','B','C','S','I') else 'J' if t=='J' else ''
with zipfile.ZipFile(a.apk) as z:
    names=[n for n in z.namelist() if re.fullmatch(r'classes\d*\.dex',n)]
    for n in names:
        data=z.read(n)
        if not any((c+';').encode() in data for c in TARGETS[a.role]):continue
        d=a.work/n;d.write_bytes(data)
        classes=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(d)],text=True).splitlines()
        matches=[c for c in classes if c.startswith(SCOPE) and c[1:-1].rsplit('/',1)[-1] in TARGETS[a.role]]
        if not matches:continue
        folder=a.work/('smali-'+n)
        run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(folder),str(d))
        for c in matches:
            f=folder/(c[1:-1]+'.smali');src=f.read_text();simple=f.stem
            def edit(m):
                b=m.group();h=b.splitlines()[0];name=h.split('(')[0].split()[-1]
                if not re.fullmatch(TARGETS[a.role][simple],name):return b
                ls=b.splitlines(keepends=True);ops=core.executable(ls)
                if not ops:return b
                prefix='STORE '+simple+'.'+name
                before={};after={}
                def add(table,i,label,typ='',reg=None):table.setdefault(i,[]).append(probe(prefix+' '+label,typ,reg))
                add(before,ops[0],'ENTER')
                for oi,i in enumerate(ops):
                    op=ls[i].strip()
                    if op.startswith('move-exception '):add(after,i,'CATCH','Ljava/lang/Object;',op.split()[-1])
                    elif op.startswith('return'):
                        ret=h.rsplit(')',1)[-1];k=kind(ret)
                        add(before,i,'RETURN',k,op.split()[-1] if k else None)
                    call=core.CALL.match(op)
                    if not call or '/hitelqa/' in op or '/hitel/qa/' in op:continue
                    if not CALLS.search(op):continue
                    owner=call['owner']
                    if not owner.startswith(PLATFORM+(SCOPE,'Lcom/lguplus/aicallagentaidl/')):continue
                    label=owner.rsplit('/',1)[-1].rstrip(';')+'.'+call['name']
                    # Record input byte count only at output write; never record contents.
                    if call['name']=='write' and call['args']=='[B':
                        regs=re.search(r'\{([^}]+)\}',op).group(1).split(',')
                        rr=regs[-1].strip() if len(regs)>1 else None
                        if rr and re.fullmatch(r'[vp]\d+',rr):add(before,i,'WRITE_INPUT '+label,'Ljava/lang/Object;',rr)
                    add(before,i,'CALL '+label)
                    j=ops[oi+1] if oi+1<len(ops) else None
                    k=kind(call['result'])
                    if j is not None and ls[j].strip().startswith('move-result'):
                        if k:add(after,j,'RESULT '+label,k,ls[j].strip().split()[-1])
                        else:add(after,j,'RESULT '+label)
                    else:add(after,i,'RETURNED '+label)
                patched=''.join(''.join(before.get(i,[]))+v+''.join(after.get(i,[])) for i,v in enumerate(ls))
                assert ''.join(v for v in patched.splitlines(keepends=True) if not core.PROBE_CALL.match(v.strip()))==b
                found.add(simple+'.'+name)
                return core.isolate_probe_exception_edges(b,patched)
            dst=METHOD.sub(edit,src)
            if dst!=src:f.write_text(dst);changed[n]=folder
    required={'main':{'CallRecordingManager.requestRecordStart','CallRecordingManager$recordingCallback$1.onCompleted','RecordRepository$saveRecordingFileToMediasStore$2.invokeSuspend','RecordingFileRepositoryImpl.queryAudioFiles'},'recorder':{'CallRecorder.startRecording','CallRecorder.stopRecord','InCallService.handleStopRecording','RecordRepositoryImpl.getRecordingFilePathFromMediaStore','GetMediaRecorderUseCase.execute'}}[a.role]
    assert required<=found,(required-found,found)
    assert 20<len(sites)<1600,len(sites)
    helper=a.helper/'com/hitel/qa/StoragePoints.smali';helper.parent.mkdir(parents=True,exist_ok=True)
    rows=['.class public final '+DESC,'.super Ljava/lang/Object;']
    for d in sites:
        k=d['kind'];width=2 if k=='J' else bool(k)
        fn={'':'mark','I':'number','J':'wide','Ljava/lang/Object;':'object'}[k]
        args='{v0, p0, p1}' if k=='J' else '{v0, p0}' if k else '{v0}'
        rows+=['',f'.method public static s{d["id"]}({k})V','    .registers '+str(2+width),'    :start','    const-string v0, '+json.dumps(d['label']),f'    invoke-static {args}, Lcom/hitel/qa/StorageTrace;->{fn}(Ljava/lang/String;{k})V','    :end','    .catchall {:start .. :end} :ignored','    return-void','    :ignored','    move-exception v0','    return-void','.end method']
    helper.write_text('\n'.join(rows)+'\n')
    newdex='classes'+str(max(int(n[7:-4] or 1) for n in names)+1)+'.dex'
    changed[newdex]=a.helper
    for n,folder in changed.items():run('java','-Xmx2600m','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(a.work/('new-'+n)),str(folder))
    with zipfile.ZipFile(a.out,'w') as out:
        for e in z.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',e.filename,re.I):continue
            out.writestr(copy.copy(e),(a.work/('new-'+e.filename)).read_bytes() if e.filename in changed else z.read(e.filename))
        out.writestr(newdex,(a.work/('new-'+newdex)).read_bytes())
    with zipfile.ZipFile(a.out) as out:
        assert all(z.read(n)==out.read(n) for n in out.namelist() if n not in changed)
report={'role':a.role,'methods':sorted(found),'site_count':len(sites),'sites':sites,'changed_dex':sorted(changed),'other_entries_identical':True}
a.report.write_text(json.dumps(report,indent=2))
print('STORAGE_TRACE_APPLIED',a.role,len(sites),sorted(found),flush=True)
