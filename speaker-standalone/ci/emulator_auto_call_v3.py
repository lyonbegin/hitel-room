#!/usr/bin/env python3
"""Real emulator GSM state event test for standalone call-controlled speaker.

Separate from actual M4A/PCM test: assert the production service sees real
TelephonyCallback RINGING -> OFFHOOK -> IDLE. Invalid SAF tree is intentionally
used here to avoid falsely claiming a live Samsung recorder was present.
"""
import pathlib,subprocess,time

APP="app.hitel.recording.speakeronly"
COMPONENT=APP+"/app.hitel.speakeronly.SpeakerService"
OUT=pathlib.Path("/tmp/standalone-v2-emulator")
OUT.mkdir(parents=True,exist_ok=True)

def adb(*args,check=True,timeout=60):
    p=subprocess.run(["adb",*args],capture_output=True,text=True,errors="replace",timeout=timeout)
    result=(p.stdout+p.stderr)
    if check and p.returncode:raise RuntimeError("adb "+str(args)+" returned "+str(p.returncode)+": "+result[-600:])
    return result

def own(*args,check=True):
    return adb("shell","run-as",APP,*args,check=check)

def seek(marker,seconds,allowFailure=False):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        logs=adb("logcat","-d","-s","GrowingM4aDiag:I","*:S",timeout=30)
        if marker in logs:
            print("ANDROID15_TELEPHONY_REAL_EVENT",marker,flush=True)
            return True
        time.sleep(.6)
    if allowFailure:return False
    raise RuntimeError("Missing actual Android TelephonyCallback event: "+marker)

def main():
    print("GSM_EMULATOR",adb("shell","getprop","ro.build.version.sdk").strip(),flush=True)
    print(adb("shell","pm","grant",APP,"android.permission.READ_PHONE_STATE"),flush=True)
    adb("logcat","-c")
    # A real user chooses a SAF folder. This gate-only test deliberately uses
    # an invalid tree to exercise call events while separately testing PCM above.
    result=own("am","start-foreground-service","--user","0",
        "-n",COMPONENT,"-a","app.hitel.speakeronly.START",
        "--es","uri","content://com.android.externalstorage.documents/tree/primary%3ARecordings",
        "--ez","folder","true","--ei","deviceId","-1",check=False)
    print("AUTO_CALL_ARM",result.strip(),flush=True)
    if "Exception" in result or "Error:" in result:
        raise RuntimeError("Auto-call foreground monitor did not arm: "+result)
    seek("AUTO_CALL_MONITOR_ARMED",12)
    seek("PHONE_STATE",12)
    number="5551231234"
    ringing=adb("emu","gsm","call",number,check=False)
    print("EMULATOR_GSM_RINGING",ringing,flush=True)
    if "KO" in ringing or "ERROR" in ringing.upper():
        raise RuntimeError("Emulator rejected test incoming call: "+ringing)
    seek("state=1",15)
    accept=adb("emu","gsm","accept",number,check=False)
    print("EMULATOR_GSM_ACCEPT",accept,flush=True)
    if "KO" in accept or "ERROR" in accept.upper():
        raise RuntimeError("Emulator rejected test call accept: "+accept)
    seek("CALL_OFFHOOK_BEGIN_LIVE_RECORDING_VALIDATION",18)
    # The invalid folder causes no live audio to be played. The app should
    # remain armed and never start arbitrary previously saved files.
    cancel=adb("emu","gsm","cancel",number,check=False)
    print("EMULATOR_GSM_END",cancel,flush=True)
    seek("CALL_IDLE_STOP_OUTPUT",18)
    state=adb("logcat","-d","-v","time")
    (OUT/"real-telephony-event-lifecycle.log").write_text(state)
    own("am","start-service","--user","0",
      "-n",COMPONENT,"-a","app.hitel.speakeronly.STOP",check=False)
    time.sleep(1)
    print("PASS_ANDROID15_REAL_GSM_TELEPHONY_OFFHOOK_IDLE_AUTOMATIC_GATE",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("FAIL_REAL_ANDROID15_GSM_CALL_EVENT_TEST",repr(e),flush=True)
        (OUT/"real-telephony-event-failure.log").write_text(adb("logcat","-d","-v","time",check=False))
        raise
