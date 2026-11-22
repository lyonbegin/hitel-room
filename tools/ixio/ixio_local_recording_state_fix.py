#!/usr/bin/env python3
"""Fix local recording state initialization, not service entitlements.
Use the original Room observation flow before any asynchronous refresh.
Only SettingViewModel changes; no relocated class or new DEX."""
import argparse,copy,json,re,subprocess,zipfile,hashlib,difflib
from pathlib import Path
P='Lcom/lguplus/aicallagent/setting/viewmodel/'
VM=P+'SettingViewModel;'
STATE=P+'SettingUiState;'
ROOM='Lcom/lguplus/aicallagent/data/room/RoomSettingRepository;'
FLOW='Lkotlinx/coroutines/flow/Flow;'
MUT='Lkotlinx/coroutines/flow/MutableStateFlow;'
METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
def run(*args):subprocess.run(args,check=True)
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
    ap=argparse.ArgumentParser()
    for n in ('apk','work','baksmali','smali','out','report'):ap.add_argument('--'+n,required=True,type=Path)
    a=ap.parse_args();a.work.mkdir(exist_ok=True)
    with zipfile.ZipFile(a.apk) as z:
        matches=[]
        for n in z.namelist():
            if not re.fullmatch(r'classes\d*\.dex',n):continue
            data=z.read(n)
            if VM.encode() not in data:continue
            f=a.work/n;f.write_bytes(data)
            classes=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(f)]).decode().splitlines()
            if VM in classes:matches.append((n,f))
        assert len(matches)==1,matches
    n,f=matches[0];folder=a.work/'smali'
    run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(folder),str(f))
    file=folder/(VM[1:-1]+'.smali');original=file.read_text()
    print('EXACT_TARGET_DEX',n,flush=True)
    # Recover and validate the real constructor, field types and copy mask
    # from the last known working APK rather than guessing register numbers.
    statefile=folder/(STATE[1:-1]+'.smali')
    if not statefile.exists():
        # Multidex: resolve the exact class definition, not a reference.
        # Disassemble the state DEX separately and never reassemble it.
        state_matches=[]
        with zipfile.ZipFile(a.apk) as z:
            for entry in z.namelist():
                if entry==n or not re.fullmatch(r'classes\d*\.dex',entry):continue
                data=z.read(entry)
                if STATE.encode() not in data:continue
                candidate=a.work/entry
                candidate.write_bytes(data)
                classes=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(candidate)]).decode().splitlines()
                if STATE in classes:state_matches.append((entry,candidate))
        assert len(state_matches)==1,state_matches
        state_entry,state_dex=state_matches[0]
        state_folder=a.work/'state_readonly'
        run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(state_folder),str(state_dex))
        statefile=state_folder/(STATE[1:-1]+'.smali')
        print('EXACT_STATE_DEX_READ_ONLY',state_entry,flush=True)
    assert statefile.exists(),statefile
    state=statefile.read_text()
    assert 'iput-object p8, p0, '+STATE+'->isCallRecording:'+FLOW in state
    descriptors=re.findall(r'(?m)^\.method public static synthetic (copy\$default\([^)]*\)'+re.escape(STATE)+r')$',state)
    assert len(descriptors)==1,descriptors
    copy_sig=descriptors[0]
    args=re.findall(r'\[*L[^;]+;|\[*[ZBCSIJFD]',copy_sig.split('(',1)[1].split(')',1)[0])
    assert len(args)==16 and args[0]==STATE and args[8]==FLOW and args[14]=='I' and args[15]=='Ljava/lang/Object;',args
    assert all(t.startswith('L') or t in ('Z','I') for t in args)
    # copy$default has 13 properties; only bit 7 (property 8) is supplied.
    mask=((1<<13)-1) & ~(1<<7)
    assert mask==0x1f7f
    ctors=[m for m in METHOD.finditer(original) if ' constructor <init>(' in m.group().splitlines()[0] and '->roomSettingRepository:'+ROOM in m.group()]
    assert len(ctors)==1
    ctor=ctors[0];body=ctor.group()
    bindpat=r'(?m)^(    iput-object ([vp]\d+), ([vp]\d+), '+re.escape(VM+'->_uiState:'+MUT)+r')$'
    bindings=list(re.finditer(bindpat,body));assert len(bindings)==1
    bind=bindings[0];thisreg=bind.group(3)
    assert body.find('->roomSettingRepository:'+ROOM)<bind.start()
    assert body.find('new-instance',0,bind.start())>=0
    # Call IMMEDIATELY after _uiState assignment. The matched object's type is
    # proven by the original iput instruction (not a stale parameter alias).
    call=f'\n    invoke-direct/range {{{thisreg} .. {thisreg}}}, {VM}->hitelBindInitialRecordingFlow()V'
    newctor=body[:bind.end()]+call+body[bind.end():]
    assert newctor.replace(call,'',1)==body
    # Make a new state with only isCallRecording replaced by the live,
    # existing repository Flow. Other fields including AI authorization
    # remain exactly as the original state.
    helper=[f'.method private final hitelBindInitialRecordingFlow()V','    .registers 21','    move-object/from16 v0, p0',
      f'    iget-object v1, v0, {VM}->roomSettingRepository:{ROOM}',
      f'    invoke-virtual {{v1}}, {ROOM}->isCallAutoRecording(){FLOW}',
      '    move-result-object v1','    move-object/from16 v19, v1',
      f'    iget-object v0, v0, {VM}->_uiState:{MUT}',
      '    :hitel_local_retry',
      f'    invoke-interface {{v0}}, {MUT}->getValue()Ljava/lang/Object;',
      '    move-result-object v1','    move-object v3, v1',f'    check-cast v3, {STATE}']
    for i in range(1,14):
        reg=i+3
        helper.append(f'    move-object/from16 v{reg}, v19' if i==8 else f'    const/16 v{reg}, 0x0')
    helper.extend([f'    const/16 v17, {hex(mask)}','    const/16 v18, 0x0',
       f'    invoke-static/range {{v3 .. v18}}, {STATE}->{copy_sig}','    move-result-object v2',
       f'    invoke-interface {{v0, v1, v2}}, {MUT}->compareAndSet(Ljava/lang/Object;Ljava/lang/Object;)Z',
       '    move-result v1','    if-eqz v1, :hitel_local_retry',
       '    return-void','.end method'])
    added='\n\n'+'\n'.join(helper)+'\n'
    patched=original[:ctor.start()]+newctor+original[ctor.end():]+added
    assert patched.replace(added,'',1).replace(call,'',1)==original
    file.write_text(patched)
    report={'dex':n,'changed_original_classes':[VM],'original_class_relocations':0,'new_dex_count':0,'field':'isCallRecording','mask':hex(mask),'init_register':thisreg,'source':'RoomSettingRepository.isCallAutoRecording','other_original_methods_unchanged':True,'original_recording_ai_authorization_unchanged':True,'before_sha256':digest(original.encode()),'after_sha256':digest(patched.encode()),'diff':''.join(difflib.unified_diff(original.splitlines(True),patched.splitlines(True)))}
    a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('LOCAL_RECORDING_STATE_FIX',json.dumps({k:v for k,v in report.items() if k!='diff'}),flush=True)
    print(report['diff'],flush=True)
    outdex=a.work/'fixed.dex'
    run('java','-Xmx2600m','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(outdex),str(folder))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out,'w') as new:
        for e in old.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',e.filename,re.I):continue
            new.writestr(copy.copy(e),outdex.read_bytes() if e.filename==n else old.read(e.filename))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out) as new:
        assert all(old.read(k)==new.read(k) for k in new.namelist() if k!=n)
    print('ALL_OTHER_APK_ENTRIES_IDENTICAL=YES',flush=True)
if __name__=='__main__':main()
