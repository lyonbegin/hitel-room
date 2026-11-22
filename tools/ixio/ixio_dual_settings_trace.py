#!/usr/bin/env python3
"""Add focused observation probes to the existing QA APK. No live auth/state/PCM changes."""
import argparse, re, json, shutil, subprocess, zipfile, copy
from pathlib import Path
import ixio_original_flow_trace as core

ROOT='com/lguplus/aicallagent/'
QA='Lcom/lguplus/aicallagent/hitelqa/DualSettingsQa;'
CLASS=re.compile(r'(?:^|/)(?:SettingScreenKt|SettingUiState|SettingViewModel|CallRecordViewModel|CallRecordScreenKt|InCallAiSettingViewModel|InCallAiSettingScreenKt|GetInCallAiToggleStateUseCase|CheckCallRecorderAppStateUseCase|CallRecord(?:er|ing)SettingRepository\w*|RoomSettingRepository|IxIDataStoreRepository|InCallAiRepository\w*|InCallAiPermission|IsCallRecorderAppPermissionGrantedUseCase|IsCallRecorderAppInstalledUseCase)(?:\$|\.smali$)')
NAMES=re.compile(r'CallRecord|CallAutoRecord|InCallAi|restoreOriginalSettings|disableCallRecorder|refreshBaseSettingData|refreshSettingData|refreshData|setCallRecorderStatus|SettingUiState|Boolean;->booleanValue|Boolean;->valueOf|FlowCollector;->emit|MutableStateFlow;->(?:compareAndSet|setValue|getValue)|MutableSharedFlow;->emit|collectAsState|State;->getValue|toOnOffString|exceptionOrNull-impl|throwOnFailure|kotlin/Result;->|Preferences;->get|MutablePreferences;->set')
SKIP=re.compile(r'^(?:<init>|<clinit>|hashCode|equals|toString|component\d+|access\$|copy(?:\$default)?)$')
GENERATED=re.compile(r'_Factory|_HiltModules|_MembersInjector|WhenMappings')
NEW_PROBE=re.compile(r'^invoke-static(?:/range)? \{[^\n]*\}, Lcom/lguplus/aicallagent/hitelqa/DualSettingsShard\d+;->s(\d+)\([^\n]*\)V$')
core.PROBE_CALL=NEW_PROBE
def run(*args):subprocess.run(args,check=True)
def regs(op):
    m=re.search(r'\{([^}]*)\}',op)
    if not m:return []
    s=m.group(1).strip()
    if '..' not in s:return [r.strip() for r in s.split(',') if r.strip()]
    a,b=map(str.strip,s.split('..'))
    if a[0]!=b[0]:return []
    return [a[0]+str(x) for x in range(int(a[1:]),int(b[1:])+1)]
def helper(desc,sites):
    o=['.class public final '+desc,'.super Ljava/lang/Object;']
    for s in sites:
        typ={'None':'','Int':'I','Object':'Ljava/lang/Object;'}[s['kind']]
        args='{v0}' if not typ else '{v0, p0}'
        fn={'None':'point','Int':'value','Object':'object'}[s['kind']]
        o.extend(['',f'.method public static s{s["id"]}({typ})V','    .registers '+str(3+bool(typ)),'    :start','    const-string v0, '+json.dumps(s['label']),f'    invoke-static {args}, {QA}->{fn}(Ljava/lang/String;{typ})V','    :end','    .catchall {:start .. :end} :ignored','    return-void','    :ignored','    move-exception v0','    return-void','.end method'])
    return '\n'.join(o)+'\n'
def main():
    p=argparse.ArgumentParser()
    for v in ('apk','root','baksmali','smali','qa','out','report'):p.add_argument('--'+v,type=Path,required=True)
    a=p.parse_args();a.root.mkdir(parents=True,exist_ok=True)
    report={'mode':'OBSERVE_EXISTING_REAL_STATE_AND_ISOLATED_LOCAL_UI_FIXTURE','sites':[],'changed_classes':[],'actual_permission_and_service_logic_changed':False}
    shards={};changed=set()
    with zipfile.ZipFile(a.apk) as z:
        dexnames=[n for n in z.namelist() if re.fullmatch(r'classes\d*\.dex',n)]
        nextdex=max(int(n[7:-4] or 1) for n in dexnames)+1
        for n in dexnames:
            data=z.read(n)
            if not any(k in data for k in [b'SettingScreenKt;',b'RoomSettingRepository;',b'GetInCallAiToggleStateUseCase;',b'CheckCallRecorderAppStateUseCase;',b'IxIDataStoreRepository;',b'DiagHooks;']):continue
            f=a.root/n;f.write_bytes(data)
            classes=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(f)]).decode()
            targets=[c for c in classes.splitlines() if (c.startswith('L'+ROOT) and CLASS.search(c[1:-1]+'.smali') and not GENERATED.search(c)) or c=='L'+ROOT+'hitelqa/DiagHooks;']
            if not targets:continue
            no=int(n[7:-4] or 1);folder=a.root/f'smali{no}'
            run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(folder),str(f))
            shards[no]=folder
    extra=a.root/f'smali{nextdex}';extra.mkdir()
    for f in a.qa.rglob('*.smali'):
        rel=f.relative_to(a.qa).as_posix()
        if not rel.startswith(ROOT+'hitelqa/DualSettingsQa'):continue
        dst=extra/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,dst)
    assert (extra/(ROOT+'hitelqa/DualSettingsQa.smali')).exists()
    moved=[]
    for no,folder in shards.items():
        sites=[];desc=f'L{ROOT}hitelqa/DualSettingsShard{no};'
        for f in sorted((folder/ROOT).rglob('*.smali')):
            rel=f.relative_to(folder).as_posix()
            if not CLASS.search(rel) or GENERATED.search(rel):continue
            src=f.read_text();parts=[];end=0;count=0
            for mat in core.METHOD.finditer(src):
                b=mat.group();ls=b.splitlines(keepends=True);h=ls[0].strip()
                name=re.search(r'\s([^\s(]+)\(',h).group(1)
                if SKIP.match(name) or ' abstract ' in h or ' native ' in h:continue
                if not NAMES.search(b) and not any(x in f.name for x in ('GetInCallAiToggleStateUseCase','CheckCallRecorderAppStateUseCase')):continue
                ops=core.executable(ls)
                if not ops:continue
                before={};after={}
                def emit(i,phase,detail,reg=None,kind='None',post=False):
                    sid=50001+len(report['sites'])
                    label=f'DS{sid} {f.stem}.{name} {phase} {detail}'
                    typ={'None':'','Int':'I','Object':'Ljava/lang/Object;'}[kind]
                    line=f'    invoke-static/range {{{reg} .. {reg}}}, {desc}->s{sid}({typ})V\n' if reg else f'    invoke-static {{}}, {desc}->s{sid}()V\n'
                    (after if post else before).setdefault(i,[]).append(line)
                    site={'id':sid,'dex':no,'class':rel,'method':h,'line':i+1,'phase':phase,'detail':detail,'kind':kind,'label':label}
                    sites.append(site);report['sites'].append(site)
                # Do not flood Compose rendering with generic events. Instead
                # capture state reads and the exact two row conversion calls.
                screen='SettingScreenKt' in f.name
                if not screen:emit(ops[0],'ENTER','instance',None if ' static ' in h else 'p0','None' if ' static ' in h else 'Object')
                if screen and name=='SettingScreen$lambda$38':
                    emit(ops[0],'ROW_INPUT','recording p5','p5','Int')
                    emit(ops[0],'ROW_INPUT','viewModel p1','p1','Object')
                for pos,i in enumerate(ops):
                    t=ls[i].strip();m=core.CALL.match(t)
                    if m and NAMES.search(t) and '/hitelqa/' not in t and not m['name'].startswith('<'):
                        detail=core.simple(m['owner'])+'.'+m['name']
                        emit(i,'CALL',detail)
                        rr=regs(t);at=0 if t.startswith('invoke-static') else 1
                        for k,typ in enumerate(core.arg_types(m['args'])):
                            if at<len(rr) and typ=='Z':emit(i,'CALL_ARG',detail+f' arg{k}',rr[at],'Int')
                            elif at<len(rr) and (m['name'] in ('emit','compareAndSet','setValue') and typ.startswith('L') and (m['name']!='compareAndSet' or k==1)):
                                emit(i,'CALL_ARG',detail+f' arg{k}',rr[at],'Object')
                            at+=2 if typ in ('J','D') else 1
                        j=ops[pos+1] if pos+1<len(ops) else None
                        if j is not None and ls[j].strip().startswith('move-result'):
                            k=core.result_kind(m['result'])
                            if k in ('Int','Object'):emit(j,'CALL_RETURN',detail,ls[j].strip().split()[-1],k,True)
                        elif m['result']=='V':emit(i,'CALL_RETURN',detail,post=True)
                    if not screen and t.startswith('move-exception '):emit(i,'CATCH','exception',t.split()[-1],'Object',True)
                    if not screen and t.startswith('throw '):emit(i,'THROW','exception',t.split()[-1],'Object')
                    if not screen and t.startswith('return'):
                        k=core.result_kind(h.split(')',1)[1])
                        if k in ('Int','Object'):emit(i,'RETURN','value',t.split()[-1],k)
                    if not screen and len(ops)<350 and t.startswith('if-'):
                        emit(i,'BRANCH',t);emit(i,'FALLTHROUGH',t,post=True)
                if not before and not after:continue
                patched=''.join(''.join(before.get(i,[]))+line+''.join(after.get(i,[])) for i,line in enumerate(ls))
                assert ''.join(l for l in patched.splitlines(keepends=True) if not NEW_PROBE.match(l.strip()))==b
                new=core.isolate_probe_exception_edges(b,patched)
                parts.extend([src[end:mat.start()],new]);end=mat.end();count+=1
            if end:
                parts.append(src[end:]);f.write_text(''.join(parts))
                # Move complete changed classes into new shard to avoid
                # increasing reference pressure on original full DEXes.
                dst=extra/rel;dst.parent.mkdir(parents=True,exist_ok=True)
                assert not dst.exists();shutil.move(f,dst)
                changed.add(no);moved.append(rel);report['changed_classes'].append({'dex':no,'class':rel,'methods':count})
        if sites:
            dst=extra/(ROOT+f'hitelqa/DualSettingsShard{no}.smali')
            dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(helper(desc,sites))
    hooks=[(no,p/(ROOT+'hitelqa/DiagHooks.smali')) for no,p in shards.items() if (p/(ROOT+'hitelqa/DiagHooks.smali')).exists()]
    assert len(hooks)==1,hooks
    no,f=hooks[0];src=f.read_text()
    m=next(m for m in core.METHOD.finditer(src) if ' onActivityResumed(Landroid/app/Activity;)V' in m.group().splitlines()[0])
    b=m.group();assert 'return-void' in b
    b=re.sub(r'(?m)^    return-void$',lambda q:'    invoke-static/range {p1 .. p1}, '+QA+'->attach(Landroid/app/Activity;)V\n'+q.group(),b)
    f.write_text(src[:m.start()]+b+src[m.end():]);changed.add(no)
    assert any(s['phase']=='ROW_INPUT' and 'recording p5' in s['detail'] for s in report['sites'])
    assert any('getInCallAiIsToggleOn' in s['detail'] for s in report['sites'])
    assert any('isCallAutoRecording' in s['detail'] for s in report['sites'])
    assert any('restoreOriginalSettingsIfNeeded' in s['detail'] for s in report['sites'])
    assert any('disableCallRecorderSettings' in s['detail'] for s in report['sites'])
    assert len(report['sites'])<12000,len(report['sites'])
    a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('DUAL_SETTINGS_SITES',len(report['sites']),'CLASSES',len(moved),flush=True)
    for no in sorted(changed|{nextdex}):
        folder=extra if no==nextdex else shards[no]
        run('java','-Xmx2600m','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(a.root/f'new{no}.dex'),str(folder))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out,'w') as new:
        for e in old.infolist():
            n=e.filename
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',n,re.I):continue
            num=int(n[7:-4] or 1) if re.fullmatch(r'classes\d*\.dex',n) else None
            new.writestr(copy.copy(e),(a.root/f'new{num}.dex').read_bytes() if num in changed else old.read(n))
        new.writestr(f'classes{nextdex}.dex',(a.root/f'new{nextdex}.dex').read_bytes())
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out) as new:
        for n in new.namelist():
            if not re.fullmatch(r'classes\d*\.dex',n):assert old.read(n)==new.read(n),n
    print('UNCHANGED_NON_DEX_ENTRIES_VERIFIED=YES',flush=True)
if __name__=='__main__':main()
