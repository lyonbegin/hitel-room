#!/usr/bin/env python3
"""Minimal observation-only patch of the previously runtime-tested main APK.
No class relocation, UI change, authentication change or permission override."""
import argparse,copy,json,re,subprocess,zipfile
from pathlib import Path
import ixio_original_flow_trace as core
ROOT='com/lguplus/aicallagent/'
DESC='L'+ROOT+'hitelqa/MinimalSettingTrace;'
CLASS_METHODS={
 'GetInCallAiToggleStateUseCase':{'invoke'},
 'SettingViewModel$checkInCallAiEnabled$1':{'invokeSuspend'},
 'SettingViewModel$refreshData$1':{'invokeSuspend'},
 'SettingViewModel':{'refreshBaseSettingData','refreshSettingData'},
 'SettingScreenKt':{'SettingScreen$lambda$38','SettingScreen'},
 'CallRecorderSettingRepositoryImpl':{'restoreOriginalSettingsIfNeeded','restoreOriginalSettings','disableCallRecorderSettings','saveOriginalSettings'},
 'CheckCallRecorderAppStateUseCase':{'getInitialCallRecorderStatus','restoreCallRecorderSettings','updateCallRecorderSettings'},
 'CheckCallRecorderAppStateUseCase$checkAndUpdatePermissionStatus$2':{'invokeSuspend'},
 'CheckCallRecorderAppStateUseCase$restoreCallRecorderSettings$2':{'invokeSuspend'},
 'CheckCallRecorderAppStateUseCase$updateCallRecorderSettings$2':{'invokeSuspend'},
 'RoomSettingRepository':{'isCallAutoRecording','setCallAutoRecording'},
}
CALLS={'getInCallAiIsToggleOn','setInCallAiIsToggleOn','getInCallAiPermissions-IoAF18A','getEnabled','exceptionOrNull-impl','isCallAutoRecording','setCallAutoRecording','isCallRecording','isInCallAiEnabled','toOnOffString','restoreOriginalSettingsIfNeeded','restoreOriginalSettings','disableCallRecorderSettings','saveOriginalSettings','getInitialCallRecorderStatus','isAppInstalled','isPermissionGranted','isFreeRoadApp','compareAndSet','refreshBaseSettingData','refreshSettingData','checkInCallAiEnabled'}
PROBE=re.compile(r'^invoke-static(?:/range)? \{[^\n]*\}, '+re.escape(DESC)+r'->s(\d+)\([^\n]*\)V$')
core.PROBE_CALL=PROBE
def run(*args):subprocess.run(args,check=True)
def main():
    p=argparse.ArgumentParser()
    for n in ('apk','work','baksmali','smali','out','report'):p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args();a.work.mkdir(exist_ok=True);sites=[];changes=[];changed={};found=set()
    with zipfile.ZipFile(a.apk) as z:
        names=[n for n in z.namelist() if re.fullmatch(r'classes\d*\.dex',n)]
        newdex=max(int(n[7:-4] or 1) for n in names)+1
        for n in names:
            data=z.read(n)
            if not any((c+';').encode() in data for c in CLASS_METHODS):continue
            d=a.work/n;d.write_bytes(data)
            listed=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(d)]).decode().splitlines()
            targets=[c[1:-1] for c in listed if c.startswith('L'+ROOT) and c[1:-1].rsplit('/',1)[-1] in CLASS_METHODS]
            if not targets:continue
            folder=a.work/('smali-'+n);run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(folder),str(d))
            for c in targets:
                f=folder/(c+'.smali');src=f.read_text();name=f.stem;parts=[];end=0
                for m in core.METHOD.finditer(src):
                    b=m.group();ls=b.splitlines(keepends=True);h=ls[0].strip();method=re.search(r'\s([^\s(]+)\(',h).group(1)
                    if method not in CLASS_METHODS[name] or ' abstract ' in h or ' native ' in h:continue
                    ops=core.executable(ls)
                    if not ops:continue
                    before={};after={};start=len(sites)
                    def emit(i,label,reg=None,k='None',post=False):
                        sid=len(sites)+1;typ={'None':'','Int':'I','Object':'Ljava/lang/Object;'}[k]
                        sites.append({'id':sid,'class':c,'method':method,'dex':n,'line':i+1,'label':name+'.'+method+' '+label,'kind':k})
                        line=f'    invoke-static/range {{{reg} .. {reg}}}, {DESC}->s{sid}({typ})V\n' if reg else f'    invoke-static {{}}, {DESC}->s{sid}()V\n'
                        (after if post else before).setdefault(i,[]).append(line)
                    for pos,i in enumerate(ops):
                        t=ls[i].strip();call=core.CALL.match(t)
                        if call and call['name'] in CALLS and call['owner'].startswith(('L'+ROOT,'Lkotlin/Result;','Lkotlinx/coroutines/flow/MutableStateFlow;')):
                            fn=call['name']
                            if name=='SettingScreenKt' and fn not in ('isCallRecording','isInCallAiEnabled','toOnOffString'):continue
                            if name=='SettingScreenKt' and fn=='toOnOffString':
                                rr=re.search(r'\{([vp]\d+)(?:\s+\.\.\s+\1)?\}',t)
                                if rr:emit(i,'ROW_BOOLEAN '+fn,rr.group(1),'Int')
                            else:emit(i,'CALL '+fn)
                            j=ops[pos+1] if pos+1<len(ops) else None
                            if j is not None and ls[j].strip().startswith('move-result'):
                                k=core.result_kind(call['result'])
                                if k in ('Int','Object'):emit(j,'RESULT '+fn,ls[j].strip().split()[-1],k,True)
                            elif call['result']=='V':emit(i,'RETURN '+fn,post=True)
                        if name=='GetInCallAiToggleStateUseCase' and t.startswith('return-object '):
                            emit(i,'RETURN',t.split()[-1],'Object')
                        if name in ('SettingViewModel$refreshData$1','SettingViewModel$checkInCallAiEnabled$1') and t.startswith('move-exception '):
                            emit(i,'CATCH',t.split()[-1],'Object',True)
                        # Successful coroutine resume uses the same cast for both
                        # synchronous and asynchronous results, so capture here.
                        if name=='GetInCallAiToggleStateUseCase' and t=='check-cast v2, Ljava/lang/Boolean;':
                            emit(i,'LOCAL_SETTING_AFTER_RESUME','v2','Object',True)
                        if name=='SettingViewModel$checkInCallAiEnabled$1' and re.fullmatch(r'move-result v8',t):
                            if pos>0 and 'Boolean;->booleanValue()Z' in ls[ops[pos-1]]:
                                emit(i,'AI_UI_NEW_VALUE','v8','Int',True)
                    if len(sites)==start:continue
                    patched=''.join(''.join(before.get(i,[]))+l+''.join(after.get(i,[])) for i,l in enumerate(ls))
                    assert ''.join(l for l in patched.splitlines(keepends=True) if not PROBE.match(l.strip()))==b
                    patched=core.isolate_probe_exception_edges(b,patched)
                    parts.extend([src[end:m.start()],patched]);end=m.end();found.add((name,method))
                if end:
                    parts.append(src[end:]);f.write_text(''.join(parts));changes.append({'dex':n,'class':c})
            changed[n]=folder
    assert ('GetInCallAiToggleStateUseCase','invoke') in found
    assert ('SettingScreenKt','SettingScreen$lambda$38') in found
    assert ('SettingViewModel$checkInCallAiEnabled$1','invokeSuspend') in found
    assert any('restoreOriginalSettingsIfNeeded' in s['label'] for s in sites)
    assert any('isCallAutoRecording' in s['label'] for s in sites)
    assert len(sites)<250 and len(changes)<20,(len(sites),len(changes))
    helper=a.work/'helper'/ (ROOT+'hitelqa/MinimalSettingTrace.smali');helper.parent.mkdir(parents=True,exist_ok=True)
    lines=['.class public final '+DESC,'.super Ljava/lang/Object;']
    for s in sites:
        k=s['kind'];typ={'None':'','Int':'I','Object':'Ljava/lang/Object;'}[k]
        fn={'None':'flow','Int':'flowInt','Object':'flowObject'}[k]
        lines+=['',f'.method public static s{s["id"]}({typ})V','    .registers '+str(3+bool(typ)),'    :start','    const-string v0, '+json.dumps('MIN_SETTINGS '+s['label']),f'    invoke-static '+('{v0, p0}' if typ else '{v0}')+', L'+ROOT+f'hitelqa/DiagTrace;->{fn}(Ljava/lang/String;{typ})V','    :end','    .catchall {:start .. :end} :ignored','    return-void','    :ignored','    move-exception v0','    return-void','.end method']
    helper.write_text('\n'.join(lines)+'\n');changed[f'classes{newdex}.dex']=a.work/'helper'
    report={'baseline':str(a.apk),'sites':sites,'changed_classes':changes,'relocated_original_classes':0,'new_classes':1,'original_method_instructions_preserved':True,'original_activity_unchanged':True,'live_service_permissions_unchanged':True}
    a.report.write_text(json.dumps(report,indent=2))
    print('MINIMAL_SETTINGS_PROBES',len(sites),'CLASSES',len(changes),'MOVED_CLASSES=0',flush=True)
    for n,folder in changed.items():run('java','-Xmx2600m','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(a.work/('new-'+n)),str(folder))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out,'w') as new:
        for e in old.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',e.filename,re.I):continue
            new.writestr(copy.copy(e),(a.work/('new-'+e.filename)).read_bytes() if e.filename in changed else old.read(e.filename))
        new.writestr(f'classes{newdex}.dex',(a.work/f'new-classes{newdex}.dex').read_bytes())
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out) as new:
        assert all(old.read(n)==new.read(n) for n in new.namelist() if n not in changed)
    print('UNCHANGED_OTHER_APK_ENTRIES=YES',flush=True)
if __name__=='__main__':main()
