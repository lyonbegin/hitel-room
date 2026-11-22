#!/usr/bin/env python3
"""Patch only recorder IPC, auth and recording-boundary method bodies for physical-device QA."""
import argparse,copy,json,re,subprocess,zipfile
from pathlib import Path
P=argparse.ArgumentParser()
for k in ('apk','work','baksmali','smali','helper','out','report'):P.add_argument('--'+k,required=True,type=Path)
a=P.parse_args();a.work.mkdir(parents=True,exist_ok=True)
HELP='Lcom/lguplus/callrecorder/hitelqa/GateTrace;'
METHOD=re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
changes=[];events=[]
def put(s,old,new,tag):
    count=s.count(old)
    assert count==1,(tag,count,old[:120])
    events.append(tag)
    return s.replace(old,new,1)
def call(fn,regs='',desc='()V'):
    return '    invoke-static {'+regs+'}, '+HELP+'->'+fn+desc+'\n'
def edit(root,cl,fn,handler):
    f=root/('com/lguplus/callrecorder/'+cl+'.smali')
    s=f.read_text();m=[m for m in METHOD.finditer(s) if m.group().splitlines()[0].split('(')[0].split()[-1]==fn]
    assert len(m)==1,(cl,fn,len(m))
    old=m[0].group();new=handler(old)
    assert new!=old,(cl,fn)
    f.write_text(s[:m[0].start()]+new+s[m[0].end():])
    changes.append(cl+'.'+fn)
def auth(s):
    s=put(s,'move-result v0\n\n    .line 814','move-result v0\n'+call('callerUid','v0','(I)V')+'\n    .line 814','caller_uid')
    s=put(s,'getPackagesForUid(I)[Ljava/lang/String;\n\n    move-result-object v0','getPackagesForUid(I)[Ljava/lang/String;\n\n    move-result-object v0\n'+call('packageCount','v0','([Ljava/lang/String;)V'),'packages_for_uid')
    s=put(s,'if-nez v0, :cond_10\n\n    return v1','if-nez v0, :cond_10\n'+call('noPackages')+'\n    return v1','no_packages_return')
    s=put(s,'move-result v5\n\n    if-eqz v5, :cond_7e','move-result v5\n'+call('expectedPackage','v5','(Z)V')+'\n    if-eqz v5, :cond_7e','main_package_match')
    s=put(s,'getApkContentsSigners()[Landroid/content/pm/Signature;\n\n    move-result-object v4','getApkContentsSigners()[Landroid/content/pm/Signature;\n\n    move-result-object v4\n'+call('signerCount','v4','([Landroid/content/pm/Signature;)V'),'multi_signer_count')
    s=put(s,'getSigningCertificateHistory()[Landroid/content/pm/Signature;\n\n    move-result-object v4','getSigningCertificateHistory()[Landroid/content/pm/Signature;\n\n    move-result-object v4\n'+call('signerCount','v4','([Landroid/content/pm/Signature;)V'),'history_count')
    s=put(s,'move-result v4\n\n    if-eqz v4, :cond_59','move-result v4\n'+call('pinnedMatch','v4','(Z)V')+'\n    if-eqz v4, :cond_59','pin_comparison')
    s=put(s,'    :cond_59\n    sget-object v4,','    :cond_59\n'+call('originalPinRejected')+'    sget-object v4,','original_pin_rejected')
    s=put(s,'    .line 846\n    :cond_81\n','    .line 846\n    :cond_81\n'+call('sameSignedKnownCaller','p0','(Landroid/content/Context;)Z')+'    move-result v2\n    if-eqz v2, :hitel_qa_signing_rejected\n    return v2\n    :hitel_qa_signing_rejected\n','same_signer_qa_fallback')
    return s
def after_result(s,target,reg,fn,typ,tag):
    rx=re.compile(r'(?m)(^    invoke-[^\n]*'+re.escape(target)+r'[^\n]*\n\s*move-result(?:-object)? '+re.escape(reg)+r'\n)')
    ms=list(rx.finditer(s));assert len(ms)==1,(tag,len(ms))
    m=ms[0];events.append(tag)
    return s[:m.end()]+call(fn,reg,typ)+s[m.end():]
def binder(s):
    s=after_result(s,'access$isCallerAllowed','v0','callerAuthorized','(Z)V','binder_auth_result')
    s=after_result(s,'checkSelfPermission','v6','permissionResult','(I)V','permission_check')
    s=put(s,'    array-length v1, v0\n','    array-length v1, v0\n'+call('missingCount','v1','(I)V'),'permission_missing_count')
    s=put(s,'invoke-interface {p0, v0}, Lkotlinx/coroutines/channels/Channel;->trySend-JP2dKIU(Ljava/lang/Object;)Ljava/lang/Object;','invoke-interface {p0, v0}, Lkotlinx/coroutines/channels/Channel;->trySend-JP2dKIU(Ljava/lang/Object;)Ljava/lang/Object;\n    move-result-object v0\n'+call('queueResult','v0','(Ljava/lang/Object;)V').rstrip('\n'),'try_send_result')
    return s
def listener(s):
    return after_result(s,'access$isCallerAllowed','v0','listenerAuthorized','(Z)V','listener_auth')
def user(s):
    return after_result(s,'access$isCallerAllowed','v0','userAuthorized','(Z)V','user_auth')
def consumer(s):
    s=put(s,'    iget v1, p0, Lcom/lguplus/callrecorder/InCallService$startCommandConsumer$1;->label:I\n','    iget v1, p0, Lcom/lguplus/callrecorder/InCallService$startCommandConsumer$1;->label:I\n'+call('consumerLabel','v1','(I)V'),'consumer_resume_label')
    s=put(s,'    if-ne p1, v0, :cond_41\n','    if-ne p1, v0, :cond_41\n'+call('consumerSuspended'),'consumer_suspend')
    s=after_result(s,'Boolean;->booleanValue','p1','consumerHasNext','(Z)V','consumer_has_next')
    s=put(s,'check-cast p1, Lcom/lguplus/callrecorder/Command;\n','check-cast p1, Lcom/lguplus/callrecorder/Command;\n'+call('command','p1','(Ljava/lang/Object;)V'),'consumer_command')
    s=put(s,'invoke-static {v4, p1}, Lcom/lguplus/callrecorder/InCallService;->access$handleCommand(Lcom/lguplus/callrecorder/InCallService;Lcom/lguplus/callrecorder/Command;)V',call('dispatchBegin')+'    invoke-static {v4, p1}, Lcom/lguplus/callrecorder/InCallService;->access$handleCommand(Lcom/lguplus/callrecorder/InCallService;Lcom/lguplus/callrecorder/Command;)V\n'+call('dispatchEnd').rstrip('\n'),'consumer_dispatch')
    return s
def handle_command(s):
    return put(s,'instance-of v0, p1, Lcom/lguplus/callrecorder/Command$StartRecording;\n','instance-of v0, p1, Lcom/lguplus/callrecorder/Command$StartRecording;\n'+call('commandIsStart','v0','(Z)V'),'handle_command_start_flag')
def handle_start(s):
    s=put(s,'    if-eqz p1, :cond_6c\n',call('handleStartEntered')+'    if-eqz p1, :cond_6c\n','handle_start_enter')
    s=after_result(s,'StringsKt;->isBlank','v0','fileNameBlank','(Z)V','file_name_validity')
    s=after_result(s,'CallRecordingUseCase;->startRecording','p1','recordStartResult','(Z)V','record_usecase_result')
    return s
def time_out(s):
    s=put(s,'    const-string v0, "[FGS_FLOW] no session started within "',call('timeoutRequested','p1','(I)V')+'    const-string v0, "[FGS_FLOW] no session started within "','timeout_requested_generation')
    s=put(s,'    iget v2, p0, Lcom/lguplus/callrecorder/RecordingSessionController;->timeoutGeneration:I\n','    iget v2, p0, Lcom/lguplus/callrecorder/RecordingSessionController;->timeoutGeneration:I\n'+call('timeoutCurrent','v2','(I)V'),'timeout_current_generation')
    s=after_result(s,'Ljava/util/Set;->isEmpty','p1','sessionsEmpty','(Z)V','timeout_sessions_empty')
    return s
def recorder(s):
    s=put(s,'invoke-virtual {p1}, Landroid/media/MediaRecorder;->prepare()V',call('prepareBegin')+'    invoke-virtual {p1}, Landroid/media/MediaRecorder;->prepare()V\n'+call('prepareEnd').rstrip('\n'),'media_prepare')
    s=put(s,'invoke-virtual {p1}, Landroid/media/MediaRecorder;->start()V',call('mediaStartBegin')+'    invoke-virtual {p1}, Landroid/media/MediaRecorder;->start()V\n'+call('mediaStartEnd').rstrip('\n'),'media_start')
    return s
with zipfile.ZipFile(a.apk) as z:
    dex=[x for x in z.namelist() if re.fullmatch(r'classes\d*\.dex',x)]
    assert 'classes6.dex' in dex
    dx=a.work/'classes6.dex';dx.write_bytes(z.read('classes6.dex'))
    root=a.work/'smali6';subprocess.run(['java','-Xmx3g','-jar',str(a.baksmali),'d','--api','34','--jobs','3','-o',str(root),str(dx)],check=True)
    for cl,fn,handler in [('InCallService','isCallerAllowed',auth),('InCallService$binder$1','startRecording',binder),('InCallService$binder$1','registerCallRecordListener',listener),('InCallService$binder$1','setUserId',user),('InCallService$startCommandConsumer$1','invokeSuspend',consumer),('InCallService','handleCommand',handle_command),('InCallService','handleStartRecording',handle_start),('RecordingSessionController','onPendingTimeout',time_out),('CallRecorder','startRecording',recorder)]:edit(root,cl,fn,handler)
    patched=a.work/'classes6-new.dex'
    subprocess.run(['java','-Xmx3g','-jar',str(a.smali),'a','--api','34','--jobs','3','-o',str(patched),str(root)],check=True)
    helper=a.helper.read_bytes()
    mx=max(int(n[7:-4] or 1) for n in dex);newdex='classes'+str(mx+1)+'.dex'
    with zipfile.ZipFile(a.out,'w') as out:
        for ent in z.infolist():
            if re.fullmatch(r'META-INF/.*\.(?:RSA|EC|DSA|SF|MF)',ent.filename,re.I):continue
            out.writestr(copy.copy(ent),patched.read_bytes() if ent.filename=='classes6.dex' else z.read(ent.filename))
        out.writestr(newdex,helper)
    with zipfile.ZipFile(a.out) as out:
        assert all(out.read(n)==z.read(n) for n in z.namelist() if n in out.namelist() and n!='classes6.dex' and not n.startswith('META-INF/'))
report={'changed_methods':changes,'injection_sites':events,'original_non_target_entries_unchanged':True,'new_dex':newdex,'restricted_qa_auth':'original manufacturer pin first, then strict known-main-package AND same APK signer as recorder'}
a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2))
print('RECORDER_AUTH_COMMAND_PATCH_OK',len(events),len(changes),newdex,flush=True)
