#!/usr/bin/env python3
"""Capture the real UI run continuously, then check the actual copy-log panel."""
from pathlib import Path
import importlib.util,json,re,subprocess,time

OUT=Path('ixio-pages-qa-results');OUT.mkdir(exist_ok=True)
assert subprocess.check_output(['adb','shell','getprop','ro.kernel.qemu'],text=True).strip()=='1'
subprocess.run(['adb','shell','svc','data','disable'],check=True)
subprocess.run(['adb','shell','svc','wifi','enable'],check=True)
subprocess.run(['adb','shell','cmd','wifi','connect-network','AndroidWifi','open'],check=False)
time.sleep(4)
(OUT/'emulator-only-wifi-network.txt').write_text(subprocess.check_output(['adb','shell','dumpsys','connectivity'],text=True))
path=OUT/'original-flow-continuous-logcat.txt'
with path.open('w',encoding='utf-8') as sink:
    capture=subprocess.Popen(['adb','logcat','-v','threadtime'],stdout=sink,stderr=subprocess.STDOUT)
    try:
        for script in ('ixio-pages-qa-emulator-robot.py','ixio-original-call-permissions.py','ixio_ai_engine_toast_gate_verify.py'):
            subprocess.run(['python3','tools/ixio/'+script],check=True)
        spec=importlib.util.spec_from_file_location('robot','tools/ixio/ixio-pages-qa-emulator-robot.py')
        robot=importlib.util.module_from_spec(spec);spec.loader.exec_module(robot)
        robot.OUT=OUT/'flow-copy-panel';robot.OUT.mkdir(exist_ok=True)
        nodes,visible=robot.snapshot(950)
        button=robot.choose(nodes,['로그'],exact=True)
        assert button,'Diagnostic log button missing after original settings interaction'
        robot.tap(button,'OPEN_REAL_PERSISTED_FLOW_LOG_PANEL')
        time.sleep(1)
        nodes,visible=robot.snapshot(951)
        joined='\n'.join(visible)
        panel_has_flow='[FLOW]' in joined
        panel_has_sequence=bool(re.search(r'#\d+ pid=\d+ tid=\d+',joined))
        # Real app snapshot loads its private diagnostic file; this checks the
        # user-visible copy source, not merely adb or generated marker strings.
        assert panel_has_flow and panel_has_sequence,'Flow events did not reach the actual in-app copy source'
        previous=set(s for s in robot.adb('logcat','-d','-s','HITEL_IXIO_DIAG:I','*:S').splitlines() if 'LOG_COPIED_TO_CLIPBOARD' in s)
        copy=robot.choose(nodes,['로그 복사'],exact=True)
        assert copy,'Real flow copy button missing'
        robot.tap(copy,'COPY_ACTUAL_ORIGINAL_FUNCTION_FLOW_PAYLOAD')
        time.sleep(1)
        current=set(s for s in robot.adb('logcat','-d','-s','HITEL_IXIO_DIAG:I','*:S').splitlines() if 'LOG_COPIED_TO_CLIPBOARD' in s)
        assert current-previous,'Actual flow payload clipboard callback missing'
        flow_copy_completed=True
    finally:
        capture.terminate()
        try:capture.wait(timeout=8)
        except subprocess.TimeoutExpired:capture.kill();capture.wait()

log=path.read_text(errors='replace')
flows=[s for s in log.splitlines() if '[FLOW]' in s]
assert flows,'No real runtime flow observations'
assert any('SettingViewModel.' in s and 'CALL_RETURN' in s for s in flows),'No actual settings call result'
assert any('UpdateAiModelUseCaseImpl.' in s and 'RETURN' in s for s in flows),'No actual model gate result'
worker_results=[s for s in flows if 'DownloadWorker.' in s and ('RETURN' in s) and 'ListenableWorker$Result$' in s]
assert worker_results,'No actual original download worker terminal result captured'
assert not re.search(r'(?:VerifyError|NoSuchMethodError|NoClassDefFoundError).*FlowTrace|FlowTrace.*(?:VerifyError|NoSuchMethodError|NoClassDefFoundError)',log),'Invalid runtime DEX instrumentation'
result={
    'actual_flow_event_count':len(flows),
    'actual_phase_counts':{p:sum((' '+p+' ') in s or s.endswith(' '+p) for s in flows) for p in ('ENTER','CALL','CALL_RETURN','RETURN','BRANCH','FALLTHROUGH','BLOCK','CATCH','ARG','STATE_VALUE','STATE_WRITE')},
    'actual_worker_terminal_results':worker_results,
    'actual_unzip_terminal_observed':any('FileUnzipWorker.' in s and 'RETURN' in s and 'ListenableWorker$Result$' in s for s in flows),
    'actual_recording_callbacks_observed':any('recordingCallback$1.on' in s for s in flows),
    'actual_copy_panel_contains_flow':panel_has_flow,
    'actual_copy_panel_contains_sequence_pid_tid':panel_has_sequence,
    'actual_flow_payload_copied_to_clipboard':flow_copy_completed,
    'physical_call_pcm_and_stt_verified':False,
}
(OUT/'original-flow-runtime-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('ORIGINAL_FLOW_REAL_RUNTIME_AND_COPY_SOURCE_VERIFIED',json.dumps(result,ensure_ascii=False),flush=True)
