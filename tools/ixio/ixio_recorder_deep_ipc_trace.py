#!/usr/bin/env python3
"""HITEL QA: original recorder-process IPC/audio/callback boundary tracing.
Never replace recorder behavior, read PCM, or log token/phone data.
"""
import argparse,hashlib,json,re
from pathlib import Path
from collections import Counter
import ixio_original_flow_trace as original

METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
CALL=re.compile(r'^invoke-\S+\s+\{[^}]*\},\s*(L[^;]+;)->([^\s(]+)\([^)]*\)(\S+)')
FOCUS=re.compile(r'Record|InCall|Audio|Pcm|Sound|Capture|Aidl|Binder|Callback|Speech|Stt|Service',re.I)
HOT=re.compile(r'AudioRecord;->read|FileOutputStream;->write|onAudioFrame|onPcmFrame',re.I)
EDGE=re.compile(r'onTransact|startRecording|stopRecording|onStarted|onError|onCompleted|onBind|onServiceConnected|onServiceDisconnected|onCreate|invokeSuspend|startForeground|setUserId|registerCallRecordListener|record|audio|pcm|capture',re.I)
SKIP=re.compile(r'^(?:<init>|<clinit>|hashCode|toString|equals|component\d+|copy\$default|access\$)')
LOGGER='Lcom/lguplus/callrecorder/hitelqa/RecorderLog;'
POINTS='Lcom/lguplus/callrecorder/hitelqa/RecorderPoints;'
original.PROBE_CALL=re.compile(r'^invoke-static \{\}, Lcom/lguplus/callrecorder/hitelqa/RecorderPoints;->p(\d+)\(\)V$')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--smali',type=Path,required=True)
    p.add_argument('--helpers',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True)
    a=p.parse_args()
    assert a.smali.is_dir() and a.helpers.is_dir()
    sites=[];changed=[];seq=0;counts=Counter()
    def make(label,hot=False):
        nonlocal seq
        seq+=1
        assert seq<10000,'Recorder sites exceed 10000; narrow to core IPC/audio/callback flow'
        sites.append(dict(id=seq,label=label[:230],hot=hot))
        return f'    invoke-static {{}}, {POINTS}->p{seq}()V\n'
    files=sorted(p for p in a.smali.rglob('*.smali')
                 if (p.relative_to(a.smali).as_posix().startswith('com/lguplus/callrecorder/')
                     or p.relative_to(a.smali).as_posix().startswith('com/lguplus/aicallagentaidl/'))
                 and FOCUS.search(p.name) and 'hitelqa' not in p.as_posix())
    for file in files:
        source=file.read_text()
        matches=list(METHOD.finditer(source))
        updated=source;method_count=0
        for match in reversed(matches):
            block=match.group(); header=block.splitlines()[0]
            name=header.split('(')[0].split()[-1]
            if SKIP.match(name) or not (EDGE.search(name) or '$' in file.stem):continue
            rows=block.splitlines(keepends=True)
            ops=original.executable(rows)
            if not ops:continue
            insert={}
            def emit(idx,what,hot=False,after=False):
                pair=insert.setdefault(idx,[[],[]])
                pair[1 if after else 0].append(make(file.stem+'.'+name+' '+what,hot))
            emit(ops[0],'ENTER')
            for j,i in enumerate(ops):
                cmd=rows[i].strip()
                if cmd.startswith(('return','throw ')):
                    emit(i,'THROW' if cmd.startswith('throw ') else 'RETURN')
                if cmd.startswith('move-exception'):emit(i,'CATCH',after=True)
                call=CALL.match(cmd)
                if not call:continue
                owner,mname,_=call.groups()
                if '/hitelqa/' in owner:continue
                if re.match(r'^(?:get[A-Z]|is[A-Z]|has[A-Z]|access\$|toString|hashCode)',mname) and not re.search(r'Record|Audio|Pcm|Capture|Error',mname,re.I):continue
                if not (owner.startswith(('Lcom/lguplus/callrecorder/','Lcom/lguplus/aicallagentaidl/',
                                          'Landroid/media/AudioRecord;','Landroid/media/MediaRecorder;',
                                          'Landroid/media/AudioManager;','Landroid/os/Binder;',
                                          'Landroid/content/Context;','Ljava/io/FileOutputStream;'))
                        and (EDGE.search(mname) or mname in ('onReceive','onCallback','onStateChanged','onCallStateChanged','onRecordingStateChanged','onException'))):continue
                label=owner.rsplit('/',1)[-1].split(';')[0]+'.'+mname
                hot=bool(HOT.search(cmd))
                emit(i,'CALL '+label,hot)
                next_i=ops[j+1] if j+1<len(ops) else None
                if next_i is not None and rows[next_i].strip().startswith('move-result'):
                    emit(next_i,'CALL_RETURN '+label,hot,after=True)
                else:
                    emit(i,'CALL_RETURN '+label,hot,after=True)
            rebuilt=[]
            for i,line in enumerate(rows):
                if i in insert:rebuilt.extend(insert[i][0])
                rebuilt.append(line)
                if i in insert:rebuilt.extend(insert[i][1])
            patched=original.isolate_probe_exception_edges(block,''.join(rebuilt))
            updated=updated[:match.start()]+patched+updated[match.end():]
            method_count+=1
        # Store numeric callback error codes, avoiding all message/token fields.
        def add_errors(m):
            block=m.group()
            if ' onError(II)V' not in block.splitlines()[0]:return block
            reg=re.search(r'(?m)^    \.(?:registers|locals) \d+$',block)
            if not reg:return block
            counts['error_hooks']+=1
            return block[:reg.end()] + f'\n    invoke-static {{p1, p2}}, {LOGGER}->error(II)V' + block[reg.end():]
        updated=METHOD.sub(add_errors,updated)
        if updated!=source:
            file.write_text(updated)
            changed.append(dict(path=file.relative_to(a.smali).as_posix(),
                                before=hashlib.sha256(source.encode()).hexdigest(),
                                after=hashlib.sha256(updated.encode()).hexdigest(),
                                methods=method_count))
            counts['classes']+=1;counts['methods']+=method_count
    assert counts['classes']>5 and counts['methods']>15,'Wrong recovered recorder DEX; no useful internal methods'
    app=list(a.smali.rglob('IXIcallrecorderApplication.smali'))
    assert len(app)==1,'Recorder Application not found'
    f=app[0];s=f.read_text()
    hits=list(METHOD.finditer(s))
    selected=[m for m in hits if re.search(r' onCreate\(\)V$',m.group().splitlines()[0])]
    assert len(selected)==1,'Application onCreate absent or ambiguous'
    m=selected[0];blk=m.group()
    supercall=list(re.finditer(r'(?m)^    invoke-super(?:/range)? \{p0\}, L[^\n]+;->onCreate\(\)V$',blk))
    assert len(supercall)==1,'Recorder Application super.onCreate missing'
    at=supercall[0].end()
    patch=blk[:at]+'\n    invoke-static {p0}, Lcom/lguplus/callrecorder/hitelqa/RecorderLogUi;->install(Landroid/app/Application;)V'+blk[at:]
    f.write_text(s[:m.start()]+patch+s[m.end():])
    helper=a.helpers/'com/lguplus/callrecorder/hitelqa/RecorderPoints.smali'
    helper.parent.mkdir(parents=True,exist_ok=True)
    assert not helper.exists()
    rows=[f'.class public final {POINTS}','.super Ljava/lang/Object;']
    for site in sites:
        fn='hot' if site['hot'] else 'mark'
        rows.extend(['',f'.method public static p{site["id"]}()V',
            '    .registers 2','    :trace_start',
            '    const-string v0, '+json.dumps(site['label']),
            f'    invoke-static {{v0}}, {LOGGER}->{fn}(Ljava/lang/String;)V',
            '    :trace_end','    .catchall {:trace_start .. :trace_end} :ignored',
            '    return-void','    :ignored','    move-exception v0','    return-void','.end method'])
    helper.write_text('\n'.join(rows)+'\n')
    result={'site_count':len(sites),'changes':changed,'counts':dict(counts),'sites':sites,
            'original_control_flow_replaced':False,'user_data_recorded':False}
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('RECORDER_INTERNAL_FUNCTION_TRACE',json.dumps({'site_count':len(sites),'counts':dict(counts)}))

if __name__=='__main__':main()
