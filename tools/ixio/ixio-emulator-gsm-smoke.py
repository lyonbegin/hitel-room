#!/usr/bin/env python3
"""Emulator-only simulated incoming GSM call; no actual PSTN call or STT success claim.

Run AFTER actual IXIO main + recorder onboarding on the SAME emulator.
Collect telecom, AIDL/service, audio and STT evidence before/after a fake call.
"""
from __future__ import annotations
import json
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

OUT = pathlib.Path("ixio-hitel-android-results/gsm-call-smoke")
OUT.mkdir(parents=True, exist_ok=True)
NUMBER = "5550100"  # Emulator-only synthetic number, never dialed on a physical network.
MAIN = "com.lguplus.aicallagent"
RECORDER = "com.lguplus.callrecorder"

def run(*args: str, timeout: int = 25) -> dict:
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, errors="replace")
        return {"cmd": list(args), "returncode": p.returncode,
                "output": (p.stdout + "\n" + p.stderr).strip()[:10000]}
    except Exception as e:
        return {"cmd": list(args), "returncode": -1, "output": repr(e)}

def adb(*args: str, timeout: int = 25) -> dict:
    return run("adb", *args, timeout=timeout)

def save(label: str) -> dict:
    evidence: dict = {}
    for key, cmd in (
        ("telecom", ("shell","dumpsys","telecom")),
        ("services", ("shell","dumpsys","activity","services",RECORDER)),
        ("phone_services", ("shell","dumpsys","activity","services",MAIN)),
        ("audio", ("shell","dumpsys","audio")),
        ("phone_pid", ("shell","pidof",MAIN)),
        ("recorder_pid", ("shell","pidof",RECORDER)),
        ("role", ("shell","cmd","role","get-role-holders","android.app.role.DIALER")),
    ):
        r=adb(*cmd,timeout=25)
        evidence[key]={"returncode":r["returncode"],"length":len(r["output"])}
        (OUT/f"{label}-{key}.txt").write_text(r["output"],encoding="utf-8")
    adb("shell","uiautomator","dump",f"/sdcard/hitel-{label}.xml",timeout=27)
    adb("pull",f"/sdcard/hitel-{label}.xml",str(OUT/f"{label}.xml"),timeout=20)
    try:
        cp=subprocess.run(["adb","exec-out","screencap","-p"],capture_output=True,timeout=17)
        if cp.stdout.startswith(b"\x89PNG"):
            (OUT/f"{label}.png").write_bytes(cp.stdout)
    except Exception:
        pass
    xml=OUT/f"{label}.xml"
    if xml.exists():
        try:
            n=ET.parse(xml).getroot()
            captions=[(x.attrib.get("text","")+" "+x.attrib.get("content-desc","")).strip()
                      for x in n.iter("node")]
            captions=[t[:200] for t in captions if t]
            evidence["visible"]=captions[-35:]
            (OUT/f"{label}-visible.txt").write_text("\n".join(captions),encoding="utf-8")
        except Exception as e:
            evidence["ui_error"]=repr(e)
    return evidence

def main() -> None:
    summary={"simulated_call_only":True,"real_pstn_call":False,
             "stt_text_verified":False,"rx_pcm_verified":False,"tx_pcm_verified":False,
             "test_number":NUMBER,"events":[]}
    initial_role=adb("shell","cmd","role","get-role-holders","android.app.role.DIALER")
    summary["default_dialer_confirmed"] = MAIN in initial_role["output"].split()
    summary["before"]=save("before")
    # Cold emulator TELEPHONY fake call, no network connection is made.
    adb("logcat","-c")
    incoming=adb("emu","gsm","call",NUMBER,timeout=17)
    summary["events"].append({"name":"gsm_call","result":incoming})
    print("GSM_SIMULATED_INCOMING_CALL",incoming["returncode"],incoming["output"][:350],flush=True)
    time.sleep(8)
    summary["ringing"]=save("ringing")
    accept=adb("emu","gsm","accept",NUMBER,timeout=17)
    summary["events"].append({"name":"gsm_accept","result":accept})
    print("GSM_SIMULATED_ACCEPT",accept["returncode"],accept["output"][:350],flush=True)
    time.sleep(12)
    summary["connected"]=save("connected")
    ended=adb("emu","gsm","cancel",NUMBER,timeout=17)
    summary["events"].append({"name":"gsm_cancel","result":ended})
    time.sleep(3)
    summary["after"]=save("after")
    full=adb("logcat","-d","-v","threadtime","-t","24000",timeout=33)["output"]
    (OUT/"logcat-simulated-call.txt").write_text(full,encoding="utf-8")
    keywords=re.compile(r"(?i)"+ "|".join([
        r"com\\.lguplus\\.(?:aicallagent|callrecorder)",r"CallRecordingService",
        r"InCallService",r"RecordRepository",r"SpeechToTextRepository",
        r"SpeechInference",r"STT",r"AudioRecord",r"sherpa",
        r"VOICE_DOWNLINK",r"VOICE_UPLINK",r"AudioFlinger",
        r"CAPTURE_AUDIO_OUTPUT",r"permission denied",r"SecurityException",
        r"telecom",r"telephony",r"gsm",r"error",r"FATAL EXCEPTION"
    ]))
    filtered=[l for l in full.splitlines() if keywords.search(l)]
    (OUT/"logcat-filtered.txt").write_text("\n".join(filtered[-2200:]),encoding="utf-8")
    summary["filtered_log_lines"]=len(filtered)
    summary["recorder_process_after"] = adb("shell","pidof",RECORDER)["output"]
    summary["main_process_after"] = adb("shell","pidof",MAIN)["output"]
    summary["caller_screen_seen"] = any(
       any(t in " ".join(summary.get(stage,{}).get("visible",[])) for t in
           ("5550100","통화 중","수신 전화","Incoming call","Calling","Answer"))
       for stage in ("ringing","connected"))
    summary["simulated_call_requested"]= incoming["returncode"]==0
    summary["stt_verified"]=False
    (OUT/"result.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding="utf-8")
    print("IXIO_GSM_CALL_SMOKE_RESULT",json.dumps({
        k:summary[k] for k in ("simulated_call_requested","caller_screen_seen",
           "default_dialer_confirmed","recorder_process_after","main_process_after",
           "filtered_log_lines","stt_verified")
    },ensure_ascii=False),flush=True)
    # A call simulator without real PCM cannot prove RX capture or STT.
    print("IXIO_REAL_RX_PCM_AND_STT_UNVERIFIED=YES",flush=True)

if __name__=="__main__":
    main()
