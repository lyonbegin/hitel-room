#!/usr/bin/env python3
"""HITEL QA: original recorder-process UI/settings/storage/IPC/audio/callback boundary tracing.
Never replace recorder behavior, read PCM, or log token/phone data.
"""
import argparse,hashlib,json,re
from pathlib import Path
from collections import Counter
import ixio_original_flow_trace as original

METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
CALL=re.compile(r'^invoke-\S+\s+\{[^}]*\},\s*(L[^;]+;)->([^\s(]+)\([^)]*\)(\S+)')
FOCUS=re.compile(r'Record|InCall|Audio|Pcm|Sound|Capture|Aidl|Binder|Callback|Speech|Stt|Service|Settings?|Preference|DataStore|Switch|Toggle|ViewModel|Repository|Activity|Fragment|Screen|Dialog|Navigation|Permission|Receiver|Provider|UseCase|Config|State|Event|Intent|Lifecycle',re.I)
GENERATED=re.compile(r'(?:_Factory|_HiltModules|_MembersInjector|_AssistedFactory|Hilt_|Dagger|\$WhenMappings|(?:^|/)R(?:\$[^/]+)?\.smali$|BuildConfig\.smali$)')
SETTINGS=re.compile(r'setting|preference|datastore|switch|toggle|permission|config|record.*state|record.*enable|auto.*record|Activity|Fragment|Screen',re.I)
STORAGE_PREFIX=('Landroid/content/SharedPreferences','Landroidx/preference/','Landroidx/datastore/','Landroid/content/ContentResolver;','Landroid/content/ContentProvider;','Landroid/content/ContentValues;','Landroidx/room/','Landroid/database/sqlite/','Landroid/database/Cursor;')
UI_PREFIX=('Landroid/widget/CompoundButton','Landroid/widget/Switch','Landroid/widget/ToggleButton','Landroid/view/View;','Landroid/app/Activity;','Landroidx/fragment/app/','Landroidx/navigation/','Landroid/content/Intent;','Landroid/os/Bundle;','Landroidx/compose/runtime/','Landroidx/lifecycle/')
FLOW_PREFIX=('Lkotlinx/coroutines/flow/','Lkotlin/coroutines/','Lkotlinx/coroutines/')
CODE_VALUE=re.compile(r'(?:^onError$|^onTransact$|^read$|^write$|^getState$|^getRecordingState$|^getErrorCode$|^getResultCode$|^checkSelfPermission$|^checkPermission$|^getAudioSessionId$)',re.I)
HOT=re.compile(r'AudioRecord;->read|FileOutputStream;->write|onAudioFrame|onPcmFrame|readPcm|writePcm|processFrame|processAudio|onAudioData|onPcmData|encodeFrame|decodeFrame|readAudio|writeAudio',re.I)
EDGE=re.compile(r'onTransact|startRecording|stopRecording|onStarted|onError|onCompleted|onBind|onServiceConnected|onServiceDisconnected|onCreate|invokeSuspend|startForeground|setUserId|registerCallRecordListener|record|audio|pcm|capture',re.I)
SKIP=re.compile(r'^(?:<init>|<clinit>|hashCode$|toString$|equals$|component\d+$|getStable$)')
LOGGER='Lcom/lguplus/callrecorder/hitelqa/RecorderLog;'
POINTS='Lcom/lguplus/callrecorder/hitelqa/RecorderPoints;'
original.PROBE_CALL=re.compile(r'^invoke-static(?:/range)? \{[^}]*\}, Lcom/lguplus/callrecorder/hitelqa/RecorderPoints;->p(\d+)\([^)]*\)V

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--smali',type=Path,required=True)
    p.add_argument('--helpers',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True)
    a=p.parse_args()
    assert a.smali.is_dir() and a.helpers.is_dir()
    sites=[];changed=[];seq=0;counts=Counter()
    context={}
    def make(label,hot=False,reg=None,kind=None,line=0,phase=''):
        nonlocal seq
        seq+=1
        assert seq<50000,'Recorder probe budget exceeded; inspect actual class inventory instead of silently dropping sites'
        kind=kind or 'None'
        site=dict(id=seq,**context,line=line,phase=phase,label=label[:260],hot=hot,value_kind=kind)
        sites.append(site);counts[phase]+=1
        typ=TYPES[kind]
        if kind=='None':return f'    invoke-static {{}}, {POINTS}->p{seq}()V\n'
        assert re.fullmatch(r'[vp]\d+',reg),reg
        return f'    invoke-static/range {{{reg} .. {reg}}}, {POINTS}->p{seq}({typ})V\n'
    files=sorted(p for p in a.smali.rglob('*.smali')
                 if (p.relative_to(a.smali).as_posix().startswith('com/lguplus/callrecorder/')
                     or p.relative_to(a.smali).as_posix().startswith('com/lguplus/aicallagentaidl/'))
                 and not GENERATED.search(p.relative_to(a.smali).as_posix()) and 'hitelqa' not in p.as_posix())
    inventory=[]
    for file in files:
        source=file.read_text()
        rel=file.relative_to(a.smali).as_posix()
        matches=list(METHOD.finditer(source))
        updated=source;method_count=0
        for match in reversed(matches):
            block=match.group(); header=block.splitlines()[0]
            name=header.split('(')[0].split()[-1]
            if SKIP.match(name) or ' abstract ' in header or ' native ' in header:continue
            rows=block.splitlines(keepends=True)
            ops=original.executable(rows)
            if not ops:continue
            context={'dex':'classes6.dex','class':rel,'method':header,'source_line':source.count('\n',0,match.start())+1}
            is_hot=bool(HOT.search(rel+'.'+name))
            is_setting=bool(SETTINGS.search(rel+'.'+name))
            insert={}
            def emit(idx,phase,detail='',hot=None,after=False,reg=None,kind=None):
                pair=insert.setdefault(idx,[[],[]])
                label='R'+str(seq+1)+' '+file.stem+'.'+name+' '+phase+(' '+detail if detail else '')
                pair[1 if after else 0].append(make(label,is_hot if hot is None else hot,reg,kind,context['source_line']+idx,phase))
            emit(ops[0],'ENTER')
            signature=re.search(r'\(([^)]*)\)',header).group(1)
            pn=0 if ' static ' in header else 1
            for n,typ in enumerate(original.arg_types(signature)):
                if typ=='Z' or name=='onError' and typ=='I':
                    emit(ops[0],'ARG','arg'+str(n),reg='p'+str(pn),kind='Int')
                elif typ.startswith('L') and re.search(r'Event;|State;|Result;|Throwable;|Exception;|Boolean;',typ):
                    emit(ops[0],'ARG','arg'+str(n),reg='p'+str(pn),kind='Object')
                pn+=2 if typ in ('J','D') else 1
            ret=header.split(')',1)[1]
            branches=not is_hot and len(ops)<350
            for j,i in enumerate(ops):
                cmd=rows[i].strip()
                if cmd.startswith('return'):
                    kind=kind_for(ret,name) if cmd!='return-void' else None
                    emit(i,'RETURN',reg=cmd.split()[-1] if kind else None,kind=kind)
                if cmd.startswith('throw '):
                    emit(i,'THROW',reg=cmd.split()[-1],kind='Object',hot=False)
                if cmd.startswith('move-exception '):
                    emit(i,'CATCH',after=True,reg=cmd.split()[-1],kind='Object',hot=False)
                if branches and cmd.startswith(('if-','packed-switch ','sparse-switch ')):
                    emit(i,'BRANCH',cmd)
                    emit(i,'FALLTHROUGH',cmd,after=True)
                if cmd.startswith(('iput-boolean ','sput-boolean ')):
                    emit(i,'STATE_WRITE',cmd.rsplit('->',1)[-1],after=True,reg=cmd.split()[1].rstrip(','),kind='Int')
                call=CALL.match(cmd)
                if not call:continue
                owner,mname,desc=call.groups()
                if '/hitelqa/' in owner or mname.startswith('<'):continue
                internal=owner.startswith(('Lcom/lguplus/callrecorder/','Lcom/lguplus/aicallagentaidl/'))
                storage=owner.startswith(STORAGE_PREFIX)
                ui=owner.startswith(UI_PREFIX)
                flow=owner.startswith(FLOW_PREFIX)
                audio=owner.startswith(('Landroid/media/','Ljava/io/File','Landroid/os/Binder;','Landroid/os/Parcel;','Landroid/os/IBinder;','Landroid/content/Context;','Landroid/telecom/','Landroid/telephony/'))
                if not (internal or storage or ui or flow or audio):continue
                if is_hot and not re.search(r'read|write|start|stop|Error|Callback',mname,re.I):continue
                label=owner.rsplit('/',1)[-1].split(';')[0]+'.'+mname
                hot=is_hot or bool(HOT.search(cmd))
                emit(i,'CALL',label,hot=hot)
                rr=register_list(cmd)
                args_desc=re.search(r'->[^ (]+\(([^)]*)\)',cmd).group(1)
                pn=0 if cmd.startswith('invoke-static') else 1
                for n,typ in enumerate(original.arg_types(args_desc)):
                    if pn<len(rr) and typ=='Z':
                        emit(i,'CALL_ARG',label+' arg'+str(n),hot=hot,reg=rr[pn],kind='Int')
                    pn+=2 if typ in ('J','D') else 1
                if flow and mname in ('emit','tryEmit','setValue','compareAndSet'):
                    n=2 if mname=='compareAndSet' else 1
                    if len(rr)>n:emit(i,'STATE_VALUE',label,hot=hot,reg=rr[n],kind='Object')
                next_i=ops[j+1] if j+1<len(ops) else None
                if next_i is not None and rows[next_i].strip().startswith('move-result'):
                    kind=kind_for(desc,mname)
                    emit(next_i,'CALL_RETURN',label,hot=hot,after=True,reg=rows[next_i].strip().split()[-1] if kind else None,kind=kind)
                else:
                    emit(i,'CALL_RETURN',label,hot=hot,after=True)
            if branches:
                targets=set(re.findall(r'(?m)^\s*(?:if-[^\n]*,\s*|goto(?:/\d+)?\s+)(:\w+)',block))
                for pos,i in enumerate(ops):
                    prev=ops[pos-1]+1 if pos else 0
                    labels=[rows[j].strip() for j in range(prev,i) if rows[j].strip() in targets]
                    if labels:emit(i,'BLOCK',','.join(labels),after=rows[i].strip().startswith(('move-exception','move-result')))
            rebuilt=[]
            for i,line in enumerate(rows):
                if i in insert:rebuilt.extend(insert[i][0])
                rebuilt.append(line)
                if i in insert:rebuilt.extend(insert[i][1])
            raw=''.join(rebuilt)
            assert re.sub(r'(?m)^    invoke-static(?:/range)? \{[^}]*\}, Lcom/lguplus/callrecorder/hitelqa/RecorderPoints;->p\d+\([^)]*\)V\n','',raw)==block,'Original instruction changed'
            patched=original.isolate_probe_exception_edges(block,raw)
            updated=updated[:match.start()]+patched+updated[match.end():]
            method_count+=1
            if is_setting:counts['settings_methods']+=1
        inventory.append({'class':rel,'original_methods':len(matches),'instrumented_methods':method_count})
        if updated!=source:
            file.write_text(updated)
            changed.append(dict(path=rel,before=hashlib.sha256(source.encode()).hexdigest(),after=hashlib.sha256(updated.encode()).hexdigest(),methods=method_count))
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
        kind=site['value_kind'];typ=TYPES[kind]
        fn=('hot' if site['hot'] else 'mark')+('' if kind=='None' else kind)
        args='{v0}' if kind=='None' else '{v0, p0}'
        rows.extend(['',f'.method public static p{site["id"]}({typ})V',
            '    .registers 3','    :trace_start',
            '    const-string v0, '+json.dumps(site['label']),
            f'    invoke-static {args}, {LOGGER}->{fn}(Ljava/lang/String;{typ})V',
            '    :trace_end','    .catchall {:trace_start .. :trace_end} :ignored',
            '    return-void','    :ignored','    move-exception v0','    return-void','.end method'])
    helper.write_text('\n'.join(rows)+'\n')
    result={'site_count':len(sites),'changes':changed,'counts':dict(counts),'sites':sites,
            'original_control_flow_replaced':False,'user_data_recorded':False,'inventory':inventory,'scope':'own recorder and AIDL namespaces, executable non-constructor methods in classes6','source_map_schema':'R<ID> class method phase original file line value_kind'}
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('RECORDER_INTERNAL_FUNCTION_TRACE',json.dumps({'site_count':len(sites),'counts':dict(counts)}))

if __name__=='__main__':main()
)
TYPES={'None':'','Int':'I','Object':'Ljava/lang/Object;'}
def kind_for(desc,name):
    if desc=='Z' or desc in ('I','S','B') and CODE_VALUE.search(name):return 'Int'
    if desc.startswith(('L','[')):return 'Object'
    return None
def register_list(cmd):
    m=re.search(r'\{([^}]*)\}',cmd)
    if not m:return []
    s=m.group(1).strip()
    if not s:return []
    if '..' not in s:return [x.strip() for x in s.split(',')]
    x,y=[x.strip() for x in s.split('..')]
    if x[0]!=y[0]:return []
    return [x[0]+str(n) for n in range(int(x[1:]),int(y[1:])+1)]

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
