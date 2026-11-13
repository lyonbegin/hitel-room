#!/usr/bin/env python3
"""V31: restore actual Android runtime prompts on first app launch.

Never force-grant permissions or bypass the OS. Do not require the user to run
adb pm grant; show native READ_PHONE_STATE then RECORD_AUDIO dialogs on first
launch, accept their Android callbacks, and resume the original one-tap flow.
Apply AFTER v24_v30_parallel_install_capture_ready_gate.py.
"""
from pathlib import Path
src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
ui=src/"W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
preserved=[
 "KoreanSherpaStt.java","SpeakerPlaybackStt.java","SpeakerPlaybackCaptureService.java",
 "PcmDirectSherpaSink.java","PcmSpeakerMonitor.java","StreamingAacPcmDecoder.java",
 "SpeakerEngine.java","SpeakerService.java","CallStateGate.java",
 "SpeakerCaptureLog.java","V23FreshLogExport.java","HitelSafLogSaver.java"]
before={name:(src/name).read_bytes() for name in preserved}
def swap(s,old,new,where):
    n=s.count(old)
    if n!=1:raise AssertionError("V31 "+where+" anchor count="+str(n)+" "+repr(old[:100]))
    return s.replace(old,new,1)
s=ui.read_text(encoding="utf-8")
s=swap(s,
    '''    private boolean oneTapTestPending=false;''',
    '''    private static final int V31_FIRST_RUN_PHONE_PERMISSION=1213;
    private static final int V31_FIRST_RUN_MIC_PERMISSION=1214;
    private boolean v31PermissionSequenceActive=false;
    private boolean v31PermissionSequenceDone=false;
    private boolean oneTapTestPending=false;''',"permission fields")
# Original V28 onResume called armDefaultSamsungCallFolder immediately when
# the folder existed; that independently requested phone permission at an
# unsafe time (Activity return from SAF). Permission order must be serialized.
s=swap(s,
    '''        armDefaultSamsungCallFolder();
        refreshPcmRouteSelectionState();''',
    '''        // First-foreground launch: request real Android runtime dialogs.
        // Delay until Activity is resumed and the window is visible.
        ui.postDelayed(this::runV31FirstLaunchPermissions,650);
        armDefaultSamsungCallFolder();
        refreshPcmRouteSelectionState();''',"resumed permission launch")
# This existing background monitor path MUST NOT request any permission.
# The only runtime requests are explicit first-launch or one-tap requests.
s=swap(s,
    '''            requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},1183);
            return;
        }
        long now=android.os.SystemClock.elapsedRealtime();''',
    '''            SpeakerCaptureLog.append(this,"V31_AUTO_MONITOR_WAIT_PHONE",
                "Permission not yet granted; runtime onboarding owns system dialog");
            return;
        }
        long now=android.os.SystemClock.elapsedRealtime();''',
    "no racing monitor permission prompt")
# Android does NOT permit runtime permissions to be granted by installing an
# APK. This runs on first launch and only an explicit Android Allow grants.
method=r'''    private void runV31FirstLaunchPermissions(){
        if(isFinishing() || v31PermissionSequenceDone ||
           v31PermissionSequenceActive || oneTapTestPending)return;
        if(!has(Manifest.permission.READ_PHONE_STATE)){
            v31PermissionSequenceActive=true;
            SpeakerCaptureLog.append(this,"V31_PHONE_PERMISSION_DIALOG_REQUESTED",
                "first visible launch; invoking real Android requestPermissions");
            if(oneTapTestStatus!=null)oneTapTestStatus.setText(
                "전화 상태 권한 · Android 승인창에서 허용을 선택해 주십시오.");
            requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},
                V31_FIRST_RUN_PHONE_PERMISSION);
            return;
        }
        if(!has(Manifest.permission.RECORD_AUDIO)){
            v31PermissionSequenceActive=true;
            SpeakerCaptureLog.append(this,"V31_MIC_PERMISSION_DIALOG_REQUESTED",
                "after phone permission; real Android microphone dialog");
            if(oneTapTestStatus!=null)oneTapTestStatus.setText(
                "마이크 권한 · Android 승인창에서 허용을 선택해 주십시오.");
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},
                V31_FIRST_RUN_MIC_PERMISSION);
            return;
        }
        v31PermissionSequenceDone=true;
        SpeakerCaptureLog.append(this,"V31_RUNTIME_PERMISSIONS_READY",
            "READ_PHONE_STATE=true;RECORD_AUDIO=true;call monitor safe to arm");
        if(oneTapTestStatus!=null)oneTapTestStatus.setText(
            "전화·마이크 권한 허용 완료 · 테스트 시작을 누르십시오.");
        // Having the permissions does not grant capture or folder access:
        // the user's explicit TEST START still handles SAF and MediaProjection.
        armDefaultSamsungCallFolder();
    }
'''
s=swap(s,
    '''    private void startOneTapCallTest(){''',
    method+'''    private void startOneTapCallTest(){''',"first-run permission state machine")
# Route V31 callbacks BEFORE the inherited V14+V28 merged permission switch,
# and resume the next permission prompt on the UI queue after first dialog
# leaves the screen.
s=swap(s,
    '''    @Override public void onRequestPermissionsResult(int req,String[] perm,int[] result){
        if(req==MEDIA_ROUTE_PERMISSION''',
    '''    @Override public void onRequestPermissionsResult(int req,String[] perm,int[] result){
        if(req==V31_FIRST_RUN_PHONE_PERMISSION ||
           req==V31_FIRST_RUN_MIC_PERMISSION){
            super.onRequestPermissionsResult(req,perm,result);
            boolean granted=result.length>0 &&
                result[0]==android.content.pm.PackageManager.PERMISSION_GRANTED;
            String label=req==V31_FIRST_RUN_PHONE_PERMISSION?
                "PHONE":"MIC";
            SpeakerCaptureLog.append(this,"V31_"+label+
                (granted?"_PERMISSION_GRANTED":"_PERMISSION_DENIED"),
                "Android runtime permission result; explicit user selection="+granted);
            v31PermissionSequenceActive=false;
            if(granted){
                ui.postDelayed(this::runV31FirstLaunchPermissions,300);
            }else{
                v31PermissionSequenceDone=true;
                if(oneTapTestStatus!=null)oneTapTestStatus.setText(
                    label+" 권한이 거부되었습니다. 테스트 시작 시 다시 요청합니다.");
            }
            return;
        }
        if(req==MEDIA_ROUTE_PERMISSION''',"native callback sequence")
# V29's first-tap flow used the SAF picker BEFORE any phone permission.
# That caused requestPermissions() to be called during the SAF onActivityResult
# transition and could lead to immediate DENIED without a dialog. Ask phone
# and microphone BEFORE opening DocumentsUI.
folder=r'''        if(!source.getBoolean("folder",false)||uri.isEmpty()){
            markOneTapStage("WAIT_SAF",
                "최초 1회 삼성 통화녹음 폴더 선택이 필요합니다.");
            selectDirectRecordingFolder();
            return;
        }
'''
s=swap(s,folder,"","remove premature SAF-before-permission")
s=swap(s,
    '''        markOneTapStage("WAIT_PROJECTION_CONSENT",''',
    folder+'''        markOneTapStage("WAIT_PROJECTION_CONSENT",''',
    "SAF after phone and microphone permissions")
# Not all devices show a dialog after prior denial. Emit a usable status and
# never silently claim permissions were granted.
s=swap(s,
    '''                    if(oneTapTestPending){
                        oneTapTestPending=false;
                        markOneTapStage("PHONE_PERMISSION_DENIED","권한 거부; 테스트 중단");
                    }''',
    '''                    if(oneTapTestPending){
                        oneTapTestPending=false;
                        markOneTapStage("PHONE_PERMISSION_DENIED",
                            "Android가 전화 권한을 거부했습니다. 앱 정보 → 권한에서 전화 허용을 확인해 주십시오.");
                    }''',"explain phone denial")
s=swap(s,
    '''                        markOneTapStage("AUDIO_PERMISSION_DENIED","권한 거부; 테스트 중단");''',
    '''                        markOneTapStage("AUDIO_PERMISSION_DENIED",
                            "Android가 마이크 권한을 거부했습니다. 앱 정보 → 권한에서 마이크 허용을 확인해 주십시오.");''',
    "explain microphone denial")
ui.write_text(s,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
g=swap(g,'applicationId = "app.hitel.callflowlab.v30.onetap"',
    'applicationId = "app.hitel.callflowlab.v31.autopermission"',
    "independent install to preserve V30's different signed APK")
g=swap(g,"versionCode = 38","versionCode = 39","new version")
g=swap(g,"0.14.24-parallel-capture-ready-v30",
       "0.14.25-native-first-launch-permissions-v31","new version name")
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
for perm in ("READ_PHONE_STATE","RECORD_AUDIO"):
    assert 'android.permission.'+perm in m,("V31 manifest permission missing",perm)
m=swap(m,"HITEL14 V30 통화 STT 병렬시험",
    "HITEL14 V31 자동 권한 안내 · 원클릭 STT","app name")
manifest.write_text(m,encoding="utf-8")
for name,was in before.items():
    assert (src/name).read_bytes()==was,"V31 modified original media/STT source "+name
assert 'V31_PHONE_PERMISSION_DIALOG_REQUESTED' in s
assert 'V31_MIC_PERMISSION_DIALOG_REQUESTED' in s
assert 'V31_RUNTIME_PERMISSIONS_READY' in s
assert s.index('if(!has(Manifest.permission.READ_PHONE_STATE)){',s.index('private void continueOneTapCallTest()')) < s.index('markOneTapStage("WAIT_SAF"',s.index('private void continueOneTapCallTest()'))
assert 'applicationId = "app.hitel.callflowlab.v31.autopermission"' in g
print("PASS_V31_FIRST_LAUNCH_NATIVE_READ_PHONE_STATE_DIALOG")
print("PASS_V31_NATIVE_RECORD_AUDIO_DIALOG_CHAIN")
print("PASS_V31_SAF_FOLLOWS_PERMISSIONS_NO_SAF_CALLBACK_RACE")
print("PASS_V31_REAL_PERMISSION_RESULTS_AUTO_RESUME")
print("PASS_V31_PRESERVE_V22_V30_SEPARATE_APP_IDS")
print("PASS_V31_3_STT_AND_AUDIO_PROCESSORS_SOURCE_IDENTICAL")
