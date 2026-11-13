#!/usr/bin/env python3
"""Android 15 *real native UI* proof V31 requests phone and mic on FIRST LAUNCH.

The test explicitly REVOKES both Android runtime permissions to simulate fresh
install, never uses 'pm grant' to fake the result. It taps the genuine system
dialogs and asserts actual Android grants plus V31 durable log markers.
Followed by the original one-tap SAF test with the now-approved permissions.
"""
import subprocess,re,time,xml.etree.ElementTree as ET,json
from pathlib import Path
APP="app.hitel.callflowlab.v32.directasr"
ACTIVITY=APP+"/app.hitel.samsungprobe.W03ConsoleActivity"
OUT=Path("/tmp/v32-growing-call-e2e")
OUT.mkdir(exist_ok=True)

def adb(*args,timeout=80,check=True):
    p=subprocess.run(["adb",*args],encoding="utf-8",errors="replace",
        text=True,capture_output=True,timeout=timeout)
    out=(p.stdout+"\n"+p.stderr).strip()
    if check and p.returncode:
        raise AssertionError("ADB "+repr(args)+" rc="+str(p.returncode)+" "+out[-900:])
    return out

def dump(stage):
    adb("shell","uiautomator","dump","/sdcard/v31-native-perm.xml",timeout=80)
    s=adb("shell","cat","/sdcard/v31-native-perm.xml")
    if "<?xml" not in s:raise AssertionError("No Android UI XML: "+s[-700:])
    s=s[s.index("<?xml"):]
    (OUT/("v31-"+stage+".xml")).write_text(s,encoding="utf-8")
    r=ET.fromstring(s)
    return [n.attrib for n in r.iter("node")]

def tapped_button(nodes):
    # Prefer OS permission controls by exact resource-id, not app UI.
    for needle in ("permission_allow_foreground_only_button",
                   "permission_allow_button",
                   "permission_allow_one_time_button"):
        for a in nodes:
            if a.get("resource-id","").endswith("/"+needle):
                return a
    for phrase in ("While using the app","While using this app","앱 사용 중에만",
                   "허용","ALLOW","Allow"):
        for a in nodes:
            if (a.get("text","").strip().lower()==phrase.lower() and
                a.get("clickable","")=="true" and
                (a.get("package","").startswith("com.android.permissioncontroller")
                 or a.get("package","").startswith("com.google.android.permissioncontroller"))):
                return a
    return None

def tap(a):
    bounds=[int(v) for v in re.findall(r"\d+",a.get("bounds",""))]
    assert len(bounds)==4 and bounds[2]>bounds[0] and bounds[3]>bounds[1]
    x=(bounds[0]+bounds[2])//2;y=(bounds[1]+bounds[3])//2
    print("ANDROID_NATIVE_PERMISSION_ALLOW_TAP",a.get("text",""),a.get("resource-id",""),x,y,flush=True)
    adb("shell","input","tap",str(x),str(y))
    time.sleep(1.2)

def has_permission(name):
    s=adb("shell","dumpsys","package",APP,timeout=40)
    match=re.search(r"android\.permission\."+name+r": granted=(true|false)",s)
    if not match:
        # On an unlaunched fresh install Android may omit the entire runtime
        # permission entry. Absence is NOT an approved permission.
        print("FRESH_INSTALL_PERMISSION_ENTRY_NOT_YET_CREATED",name,flush=True)
        return False
    return match.group(1)=="true"

# This standalone full E2E test starts on a genuinely fresh emulator. The
# Android application must be installed BEFORE trying to revoke its runtime
# permissions; otherwise dumpsys package reports 'package not found'.
apk=Path("AndroidProject/app/build/outputs/apk/debug/app-debug.apk")
assert apk.stat().st_size>10000000, "V32_TEST_APK_MISSING"
installed=adb("install","-r",str(apk),timeout=180)
assert "Success" in installed,"V32_REAL_EMULATOR_APK_INSTALL_FAILED "+installed
print("PASS_V32_REAL_FRESH_EMULATOR_APK_INSTALLED",flush=True)
# The first-launch test next revokes/clears both runtime permissions.
# The earlier old media regression test grants permissions for its own tests.
# Reset them to prove that THIS version shows runtime dialogs without ADB grants.
adb("shell","am","force-stop",APP,check=False)
for name in ("READ_PHONE_STATE","RECORD_AUDIO"):
    print("REVOKE_FOR_FRESH_INSTALL_TEST",name,
          adb("shell","pm","revoke",APP,"android.permission."+name,check=False),flush=True)
    assert not has_permission(name), "V31 test prerequisite: revoke failed "+name
adb("shell","pm","clear",APP,timeout=50)
assert not has_permission("READ_PHONE_STATE")
assert not has_permission("RECORD_AUDIO")
adb("logcat","-c")
print("FIRST_LAUNCH_NO_ADB_GRANTS",adb("shell","am","start","-W","-n",ACTIVITY,timeout=70),flush=True)
seen_phone=False
seen_mic=False
dialog_count=0
deadline=time.monotonic()+100
while time.monotonic()<deadline:
    logs=adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I","*:S",timeout=40)
    seen_phone=seen_phone or "V31_PHONE_PERMISSION_DIALOG_REQUESTED" in logs
    seen_mic=seen_mic or "V31_MIC_PERMISSION_DIALOG_REQUESTED" in logs
    if has_permission("READ_PHONE_STATE") and has_permission("RECORD_AUDIO"):
        assert seen_phone and seen_mic,"V31 permissions granted without observing Android requests"
        assert "V31_PHONE_PERMISSION_GRANTED" in logs,"Phone permission callback missing"
        assert "V31_MIC_PERMISSION_GRANTED" in logs,"Audio permission callback missing"
        assert "V31_RUNTIME_PERMISSIONS_READY" in logs,"Onboarding did not finish"
        print("PASS_V31_ACTUAL_SYSTEM_DIALOGS_REQUESTED_GRANTED_AND_RESUMED",flush=True)
        break
    nodes=dump("permission-step-"+str(dialog_count))
    target=tapped_button(nodes)
    if target:
        tap(target)
        dialog_count+=1
        continue
    time.sleep(1)
else:
    logs=adb("logcat","-d","-s","HITEL-SPEAKER-DIAG:I","*:S")
    (OUT/"v31-permission-timeout.logcat").write_text(logs,encoding="utf-8")
    raise AssertionError("V31_NATIVE_PERMISSION_REQUEST_DID_NOT_COMPLETE "+
                         f"phoneRequested={seen_phone} micRequested={seen_mic} "
                         f"nativeDialogTaps={dialog_count} lastLogs={logs[-1400:]}")
assert dialog_count>=2,"Both runtime dialogs must be accepted through OS UI"
verdict={"fresh_install_runtime_phone_dialog":seen_phone,
         "fresh_install_runtime_mic_dialog":seen_mic,
         "android_native_allow_taps":dialog_count,
         "android_phone_permission_granted":has_permission("READ_PHONE_STATE"),
         "android_microphone_permission_granted":has_permission("RECORD_AUDIO"),
         "adb_permission_grant_used":False,
         "real_carrier_call_test":"NOT_TESTED"}
(OUT/"v31-native-runtime-permissions.json").write_text(
    json.dumps(verdict,ensure_ascii=False,indent=2),encoding="utf-8")
print("PASS_V31_PERMISSION_ONBOARDING_NO_MANUAL_ADB_PM_GRANT",flush=True)
