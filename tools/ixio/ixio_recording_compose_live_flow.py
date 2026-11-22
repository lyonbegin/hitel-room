#!/usr/bin/env python3
"""Bind the real Compose recording row directly to the existing Room Flow.
No authentication, permission, recorder engine or STT changes."""
import argparse,copy,json,re,subprocess,zipfile
from pathlib import Path
ROOT='Lcom/lguplus/aicallagent/'
VM=ROOT+'setting/viewmodel/SettingViewModel;'
STATE=ROOT+'setting/viewmodel/SettingUiState;'
SCREEN=ROOT+'setting/screen/SettingScreenKt;'
FLOW='Lkotlinx/coroutines/flow/Flow;'
TRACE=ROOT+'hitelqa/DiagTrace;'
METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
def run(*a):subprocess.run(a,check=True)
def patch_method(src,name,transform):
    ms=[m for m in METHOD.finditer(src) if name in m.group().splitlines()[0]]
    assert len(ms)==1,(name,len(ms))
    m=ms[0]
    return src[:m.start()]+transform(m.group())+src[m.end():]
def main():
    p=argparse.ArgumentParser()
    for n in ('apk','work','baksmali','smali','out','report'):p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args();a.work.mkdir(exist_ok=True)
    matches={};folders={}
    with zipfile.ZipFile(a.apk) as z:
        for n in z.namelist():
            if not re.fullmatch(r'classes\d*\.dex',n):continue
            b=z.read(n)
            if not any(c.encode() in b for c in (VM,SCREEN)):continue
            f=a.work/n;f.write_bytes(b)
            classes=subprocess.check_output(['java','-jar',str(a.baksmali),'list','classes',str(f)]).decode().splitlines()
            for c in (VM,SCREEN):
                if c in classes:
                    assert c not in matches
                    matches[c]=n
            if any(c in classes for c in (VM,SCREEN)):
                folder=a.work/('src-'+n)
                run('java','-Xmx2600m','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(folder),str(f))
                folders[n]=folder
    assert set(matches)=={VM,SCREEN},matches
    vf=folders[matches[VM]]/(VM[1:-1]+'.smali')
    sf=folders[matches[SCREEN]]/(SCREEN[1:-1]+'.smali')
    v=vf.read_text();s=sf.read_text()
    # Start from the previously signed state-fix version. Cache exactly the
    # existing Room Flow, not a synthetic Boolean or a newly created state.
    field='hitelRecordingRoomFlow:'+FLOW
    assert field not in v
    first=re.search(r'(?m)^\.method ',v);assert first
    # DEX field declarations must precede methods.
    v=v[:first.start()]+'.field private '+field+'\n\n'+v[first.start():]
    def bind(b):
        old='    move-result-object v1\n'
        i=b.index('->isCallAutoRecording()'+FLOW)
        j=b.index(old,i)+len(old)
        return b[:j]+'    iput-object v1, v0, '+VM+'->'+field+'\n'+b[j:]
    v=patch_method(v,' hitelBindInitialRecordingFlow()V',bind)
    v+='\n\n.method public final hitelGetRecordingRoomFlow()'+FLOW+'\n    .registers 1\n    iget-object p0, p0, '+VM+'->'+field+'\n    return-object p0\n.end method\n'
    # The original Compose collection and lifetime remain intact. Change only
    # its source from a replaceable UI-state snapshot to the stable ViewModel Flow.
    def screen(b):
        pat=r'(?m)^    invoke-virtual(?:/range)? \{([^}]+)\}, '+re.escape(STATE+'->isCallRecording()'+FLOW)+r'$'
        hits=list(re.finditer(pat,b));assert len(hits)==1,len(hits)
        m=hits[0];before=b[:m.start()]
        n=int(re.search(r'(?m)^    \.registers (\d+)',b).group(1))
        # Static original method has seven one-word parameters. p3 is VM.
        def canon(r):
            return int(r[1:]) if r.startswith('v') else n-7+int(r[1:])
        def stable(reg,segment):
            for line in segment.splitlines():
                op=re.match(r'^\s*([a-z][a-z0-9/.-]*) ([vp]\d+)(?:,|$)',line)
                if not op:continue
                code,r=op.groups()
                if code.startswith(('if-','return','iput','sput','aput','monitor','throw','packed-switch','sparse-switch','check-cast','fill-array-data')):continue
                if canon(r)==canon(reg):return False
            return True
        assert 'Lcom/lguplus/aicallagent/setting/viewmodel/SettingViewModel;Landroidx/compose/runtime/Composer;II)V' in b.splitlines()[0]
        if stable('p3',before):
            reg='p3'
        else:
            gs=list(re.finditer(r'(?m)^    invoke-virtual(?:/range)? \{([vp]\d+)(?: \.\. \1)?\}, '+re.escape(VM)+r'->getUiState\(\)[^\n]+$',before))
            assert gs,'No verified original ViewModel receiver'
            g=gs[-1];reg=g.group(1)
            assert stable(reg,b[g.end():m.start()]),'ViewModel receiver overwritten'
        print('VERIFIED_ORIGINAL_COMPOSE_FLOW_RECEIVER',reg,flush=True)
        return b[:m.start()]+'    invoke-virtual/range {'+reg+' .. '+reg+'}, '+VM+'->hitelGetRecordingRoomFlow()'+FLOW+b[m.end():]
    s=patch_method(s,' SettingScreen(Lkotlin/jvm/functions/Function0;',screen)
    # Record the exact value passed to the existing row formatter, not the DB.
    def row(b):
        old='    invoke-static/range {p5 .. p5}, '+ROOT+'util/UtilKt;->toOnOffString(Z)Ljava/lang/String;'
        assert b.count(old)==1
        return b.replace(old,'    invoke-static/range {p5 .. p5}, '+SCREEN+'->hitelTraceRecordingRow(Z)V\n'+old,1)
    s=patch_method(s,' SettingScreen$lambda$38(',row)
    s+='\n\n.method private static hitelTraceRecordingRow(Z)V\n    .registers 2\n    :start\n    const-string v0, "HITEL_RECORDING_ROW_RENDER"\n    invoke-static {v0, p0}, '+TRACE+'->flowInt(Ljava/lang/String;I)V\n    :end\n    .catch Ljava/lang/Throwable; {:start .. :end} :ignored\n    return-void\n    :ignored\n    move-exception v0\n    return-void\n.end method\n'
    vf.write_text(v);sf.write_text(s)
    report={'changed_classes':[VM,SCREEN],'dexes':matches,'source':'original Room Flow cached by actual ViewModel','existing_compose_collector_preserved':True,'existing_row_formatter_preserved':True,'service_entitlement_changes':False,'new_dex_count':0}
    a.report.write_text(json.dumps(report,indent=2))
    for n,folder in folders.items():
        run('java','-Xmx2600m','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(a.work/('new-'+n)),str(folder))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out,'w') as new:
        for e in old.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',e.filename,re.I):continue
            new.writestr(copy.copy(e),(a.work/('new-'+e.filename)).read_bytes() if e.filename in folders else old.read(e.filename))
    with zipfile.ZipFile(a.apk) as old,zipfile.ZipFile(a.out) as new:
        assert all(old.read(k)==new.read(k) for k in new.namelist() if k not in folders)
    print('ONLY_TWO_EXISTING_CLASSES_PATCHED',json.dumps(report),flush=True)
if __name__=='__main__':main()
