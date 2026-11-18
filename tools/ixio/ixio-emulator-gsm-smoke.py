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
        # Logcat can exceed 10 KB during a single call. Truncating the
        # beginning hides the recorder's actual post-tap exception/events.
        max_chars = 2_000_000 if "logcat" in args else 50_000
        return {"cmd": list(args), "returncode": p.returncode,
                "output": (p.stdout + "\n" + p.stderr).strip()[:max_chars]}
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
    # The original call-recording settings UI was observed in the real
    # emulator run: "통화 자동 녹음", "모든 전화", "선택 전화".
    # Previously the original app logged originalCallAutoRecording:false.
    # Select "모든 전화" via its actual accessibility node before the fake
    # call. This is a disposable emulator and a synthetic GSM number only.
    summary["auto_record_setting_tap"]=False
    prior=summary["before"].get("visible",[])
    settings_xml=OUT/"before.xml"
    if ("통화 자동 녹음" in prior and "모든 전화" in prior
            and settings_xml.exists()):
        try:
            nodes=ET.parse(settings_xml).getroot().iter("node")
            matches=[n.attrib for n in nodes
                     if n.attrib.get("text","").strip()=="모든 전화"]
            if len(matches)==1:
                m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",
                               matches[0].get("bounds",""))
                if m:
                    x1,y1,x2,y2=map(int,m.groups())
                    if 250 < y1 < 1000 and x2>x1 and y2>y1:
                        pressed=adb("shell","input","tap",str((x1+x2)//2),
                                    str((y1+y2)//2),timeout=12)
                        summary["auto_record_setting_tap"]=pressed["returncode"]==0
                        print("IXIO_ORIGINAL_AUTO_RECORD_ALL_CALLS_TAPPED",
                              summary["auto_record_setting_tap"],"bounds",
                              matches[0].get("bounds"),flush=True)
                        time.sleep(3)
                        summary["auto_record_selected"]=save("auto_record_selected")
        except Exception as exc:
            print("IXIO_ORIGINAL_AUTO_RECORD_UI_ERROR",repr(exc),flush=True)
    else:
        print("IXIO_ORIGINAL_AUTO_RECORD_SETTINGS_NOT_VISIBLE",repr(prior),flush=True)
    # Switch foreground from recorder's auto-recording settings to the ORIGINAL
    # IXIO default dialer BEFORE the simulated GSM call. Previously Telecom
    # confirmed InCallServiceImpl bound and call ACTIVE while the recorder
    # settings Activity remained over the in-call UI, hiding record controls.
    print("ORIGINAL_RECORDER_TO_MAIN_DIALER_FOREGROUND_BEGIN",flush=True)
    main_launch=adb("shell","monkey","-p",MAIN,"-c",
                    "android.intent.category.LAUNCHER","1",timeout=25)
    summary["main_dialer_foreground_request"]=main_launch
    print("MAIN_DIALER_FOREGROUND_LAUNCH",main_launch["returncode"],
          main_launch["output"][-360:],flush=True)
    time.sleep(4)
    summary["main_foreground"]=save("main_foreground")
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
    # The emulator's GSM modem has delivered the call to IXIO's genuine
    # InCallService, but its original CallActivity may remain backgrounded.
    # Probe the genuine, system-created ongoing-call notification instead of
    # force-starting a private Activity or changing original IXIO bytecode.
    summary["call_notification_probe_attempted"]=True
    summary["call_notification_expanded"]=False
    summary["call_notification_tapped"]=False
    expand=adb("shell","cmd","statusbar","expand-notifications",timeout=12)
    summary["call_notification_expanded"]=expand["returncode"]==0
    print("IXIO_SYSTEM_CALL_NOTIFICATION_SHADE_OPENED",
          summary["call_notification_expanded"],flush=True)
    if summary["call_notification_expanded"]:
        time.sleep(2)
        shade=save("call_notification_shade")
        print("IXIO_SYSTEM_CALL_NOTIFICATION_LABELS",
              repr(shade.get("visible",[]))[:1200],flush=True)
        shade_xml=OUT/"call_notification_shade.xml"
        if shade_xml.exists():
            try:
                nodes=[n.attrib for n in ET.parse(shade_xml).getroot().iter("node")]
                match=re.compile(r"(?i)(ongoing call|return to call|통화 중|"
                                 r"진행 중인 통화|통화로 돌아가기|5550100)")
                candidates=[]
                for n in nodes:
                    label=" ".join((n.get("text",""),n.get("content-desc",""))).strip()
                    if match.search(label) and n.get("clickable")=="true":
                        b=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",
                                       n.get("bounds",""))
                        if b:
                            a1,b1,a2,b2=map(int,b.groups())
                            if 0<=a1<a2<=1300 and 30<=b1<b2<=2300:
                                candidates.append((n,label,(a1+a2)//2,(b1+b2)//2))
                if len(candidates)==1:
                    _,label,x,y=candidates[0]
                    action=adb("shell","input","tap",str(x),str(y),timeout=12)
                    summary["call_notification_tapped"]=action["returncode"]==0
                    print("IXIO_GENUINE_SYSTEM_CALL_NOTIFICATION_TAPPED",
                          summary["call_notification_tapped"],label[:120],flush=True)
            except Exception as exc:
                summary["call_notification_probe_error"]=repr(exc)
    # In Android 14 this actual Pixel_6 emulator successfully captured the
    # IXIO "Ongoing call" notification in PNG, yet uiautomator dump returned
    # no XML for the SystemUI notification shade (proved in run 44212635729).
    # A screen-backed coordinate may be used ONLY for this exact emulator size,
    # while the identical active synthetic telecom call is present. Never tap
    # the red "Hang Up" action (which is far below the notification title).
    if not summary["call_notification_tapped"]:
        image_file=OUT/"call_notification_shade.png"
        active_call=(OUT/"connected-telecom.txt").read_text(errors="replace")
        notice_dump=adb("shell","dumpsys","notification","--noredact",timeout=20)
        summary["call_notification_in_system_dump"] = (
            "com.lguplus.aicallagent" in notice_dump["output"]
        )
        summary["call_notification_telecom_active"] = (
            "state=ACTIVE" in active_call and "com.lguplus.aicallagent" in active_call
        )
        screenshot_dimensions=None
        if image_file.is_file():
            content=image_file.read_bytes()
            if content.startswith(bytes.fromhex("89504e470d0a1a0a")) and len(content)>=24:
                import struct
                screenshot_dimensions=struct.unpack(">II",content[16:24])
        summary["call_notification_screenshot_dimensions"]=screenshot_dimensions
        allow_screen_fallback=(
            not (OUT/"call_notification_shade.xml").exists()
            and screenshot_dimensions==(1080,2400)
            and summary["call_notification_telecom_active"]
            and summary["call_notification_in_system_dump"]
        )
        print("IXIO_NOTIFICATION_VERIFIED_SCREEN_FALLBACK_GUARDS",
              "dims",screenshot_dimensions,
              "telecom_active",summary["call_notification_telecom_active"],
              "android_notif_present",summary["call_notification_in_system_dump"],
              "allowed",allow_screen_fallback,flush=True)
        if allow_screen_fallback:
            # Verified screen from 44212635729: title at original pixel
            # x~250..750,y~630..755; hangup action centered near y~840.
            x,y=570,685
            tap_result=adb("shell","input","tap",str(x),str(y),timeout=12)
            summary["call_notification_tapped"]=tap_result["returncode"]==0
            summary["call_notification_tap_method"]="EXACT_VERIFIED_PIX6_CALL_TITLE_570_685"
            print("IXIO_VERIFIED_REAL_CALL_NOTIFICATION_TITLE_TAPPED",
                  summary["call_notification_tapped"],x,y,flush=True)
    if not summary["call_notification_tapped"]:
        adb("shell","cmd","statusbar","collapse",timeout=12)
    time.sleep(2)
    summary["after_notification_probe"]=save("after_notification_probe")
    print("IXIO_AFTER_SYSTEM_CALL_NOTIFICATION",
          repr(summary["after_notification_probe"].get("visible",[]))[:1200],
          flush=True)
    summary["recorder_service_active_before_manual_toggle"]=bool(re.search(
        r"com\.lguplus\.callrecorder/[^\s}]*?(?:CallRecordingService|RecordService)",
        (OUT/"connected-services.txt").read_text(errors="replace")
        if (OUT/"connected-services.txt").exists() else ""))
    print("IXIO_AUTO_RECORD_SERVICE_AT_CONNECTED",
          summary["recorder_service_active_before_manual_toggle"],flush=True)
    # Trigger the real in-call recording control (not just the settings
    # screen). Original UI XML from run 43889791915 proves the icon bounds
    # [144,1691][218,1765]. Select by semantic content-desc on THIS run.
    summary["record_button_tapped"]=False
    xml=OUT/("after_notification_probe.xml" if summary["call_notification_tapped"] else "connected.xml")
    if xml.exists() and not summary["recorder_service_active_before_manual_toggle"]:
        try:
            nodes=list(ET.parse(xml).getroot().iter("node"))
            choices=[n.attrib for n in nodes
                     if (n.attrib.get("content-desc","").strip()=="통화 녹음" or
                         n.attrib.get("text","").strip()=="통화 녹음")]
            choices.sort(key=lambda n:0 if n.get("content-desc","")=="통화 녹음" else 1)
            for node in choices:
                m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",
                               node.get("bounds",""))
                if not m:continue
                x1,y1,x2,y2=map(int,m.groups())
                if not (300<y1<2300 and x2>x1 and y2>y1):continue
                tx,ty=(x1+x2)//2,(y1+y2)//2
                tapped=adb("shell","input","tap",str(tx),str(ty),timeout=10)
                summary["record_button_tapped"]=tapped["returncode"]==0
                print("IXIO_REAL_INCALL_RECORD_BUTTON_TAPPED",summary["record_button_tapped"],"x",tx,"y",ty,flush=True)
                break
        except Exception as exc:
            print("IXIO_RECORD_BUTTON_INSPECT_ERROR",repr(exc),flush=True)
    if summary["record_button_tapped"]:
        time.sleep(8)
        summary["record_toggle"]=save("record_toggle")
    recorder_services=(OUT/"record_toggle-services.txt").read_text(errors="replace") if (OUT/"record_toggle-services.txt").exists() else ""
    summary["recording_service_bound_after_toggle"]=bool(re.search(
        r"com\.lguplus\.callrecorder/(?:com\.lguplus\.callrecorder\.)?CallRecordingService",
        recorder_services))
    summary["recorder_incall_service_seen_after_toggle"]=bool(re.search(
        r"com\.lguplus\.callrecorder/(?:com\.lguplus\.callrecorder\.)?InCallService",
        recorder_services))
    print("IXIO_RECORDER_AIDL_SERVICE_AFTER_TOGGLE",
          summary["recording_service_bound_after_toggle"],flush=True)
    ended=adb("emu","gsm","cancel",NUMBER,timeout=17)
    summary["events"].append({"name":"gsm_cancel","result":ended})
    time.sleep(3)
    summary["after"]=save("after")
    full=adb("logcat","-d","-v","threadtime","-t","24000",timeout=33)["output"]
    (OUT/"logcat-simulated-call.txt").write_text(full,encoding="utf-8")
    keywords=re.compile(r"(?i)"+ "|".join([
        r"com\.lguplus\.(?:aicallagent|callrecorder)",r"CallRecordingService",
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
           ("5550100","통화 중","수신 전화","Incoming call","Calling","Answer",
            "음소거","통화 녹음","스피커","녹음"))
       for stage in ("ringing","connected","after_notification_probe"))
    summary["simulated_call_requested"]= incoming["returncode"]==0
    summary["stt_verified"]=False
    (OUT/"result.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding="utf-8")
    print("IXIO_GSM_CALL_SMOKE_RESULT",json.dumps({
        k:summary[k] for k in ("simulated_call_requested","caller_screen_seen",
           "default_dialer_confirmed","recorder_process_after","main_process_after",
           "filtered_log_lines","auto_record_setting_tap","recorder_service_active_before_manual_toggle","record_button_tapped","recording_service_bound_after_toggle","recorder_incall_service_seen_after_toggle","stt_verified","call_notification_expanded","call_notification_tapped","call_notification_in_system_dump","call_notification_tap_method")
    },ensure_ascii=False),flush=True)
    # A call simulator without real PCM cannot prove RX capture or STT.
    print("IXIO_REAL_RX_PCM_AND_STT_UNVERIFIED=YES",flush=True)

if __name__=="__main__":
    main()
