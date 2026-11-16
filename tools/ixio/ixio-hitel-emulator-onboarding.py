#!/usr/bin/env python3
"""Investigate the delivered IXIO main APK on a clean Android14 emulator.

Automates only onboarding UI navigation, explanatory '확인' and Android runtime
permission prompts. Never submits phone/account data, accepts service terms,
or requests carrier subscription. Captures each intermediate screen and logcat.
"""
from __future__ import annotations
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path("ixio-main-permission-to-signup-evidence")
OUT.mkdir(parents=True,exist_ok=True)
PKG="com.lguplus.aicallagent"
APK=".ixio-start-test/IXIO_Main_NoAppSealing_Single.apk"
ACTIONS=[]
ERRORS=[
    "서비스에 가입할 수 없","가입할 수 없","가입이 불가능",
    "서비스 가입을 완료할 수 없",
    "서비스 연결이 원활하지 않아요",
    "서비스를 이용할 수 없","가입할 수 없습니다",
    "지원하지 않는 단말","서비스 이용 불가","가입 대상이 아",
    "현재 가입이 불가","이용 대상이 아","지원하지 않는 기기",
]
CONSENT_BLOCKS=[
    "이용약관","서비스 약관","개인정보 수집 및 이용 동의",
    "개인정보 제공 동의","로그인/회원가입","로그인 및 회원가입",
    "생년월일","휴대폰 번호 입력","휴대전화 번호",
]

def cmd(*args,timeout=20,write=None):
    try:
        result=subprocess.run(args,timeout=timeout,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        if write:
            Path(write).write_bytes(result.stdout)
        return result.stdout.decode("utf8",errors="replace")
    except Exception as exc:
        return "EXECUTION_ERROR:"+repr(exc)

def adb(*args,timeout=22,write=None):
    return cmd("adb",*args,timeout=timeout,write=write)

def screenshot(name):
    try:
        cp=subprocess.run(["adb","exec-out","screencap","-p"],timeout=12,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if cp.stdout.startswith(b"\x89PNG"):
            (OUT/f"{name}.png").write_bytes(cp.stdout)
    except Exception as e:print("SCREENSHOT_ERROR",repr(e),flush=True)

def snapshot(i):
    stage=f"stage-{i:02d}"
    pid=adb("shell","pidof",PKG).strip()
    (OUT/f"{stage}-pid.txt").write_text(pid,encoding="utf8")
    screenshot(stage)
    adb("shell","uiautomator","dump",f"/sdcard/{stage}.xml",timeout=24,
        write=OUT/f"{stage}-uiautomator-command.txt")
    adb("pull",f"/sdcard/{stage}.xml",str(OUT/f"{stage}-ui.xml"),timeout=20,
        write=OUT/f"{stage}-pull.txt")
    nodes=[]
    path=OUT/f"{stage}-ui.xml"
    if path.exists():
        try:
            root=ET.parse(path).getroot()
            nodes=[e.attrib for e in root.iter("node")]
        except Exception as e:
            print("XML_PARSE_FAILED",stage,repr(e),flush=True)
    text=[" ".join((n.get("text",""),n.get("content-desc",""))).strip() for n in nodes]
    visible=[x for x in text if x]
    (OUT/f"{stage}-visible.txt").write_text("\n".join(visible),encoding="utf8")
    (OUT/f"{stage}-activity.txt").write_text(
        adb("shell","dumpsys","activity","activities",timeout=20),encoding="utf8")
    print(f"STAGE={stage} PID={pid!r} TEXT={visible[:50]!r}",flush=True)
    ACTIONS.append({"stage":stage,"pid":pid,"visible":visible[:80]})
    return nodes,visible

def choose(nodes,phrases,exact=True,require_permission=False):
    for phrase in phrases:
        for node in nodes:
            label=(node.get("text","")+" "+node.get("content-desc","")).strip()
            if not label:continue
            if not ((label==phrase) if exact else (phrase in label)):continue
            if require_permission and not any(key in node.get("package","") for key in ("permissioncontroller","packageinstaller")):
                continue
            rect=node.get("bounds","")
            m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",rect)
            if not m:continue
            a,b,c,d=map(int,m.groups())
            return (a+c)//2,(b+d)//2,label
    return None

def tap(where,label):
    x,y,_=where
    print(f"ADJUSTMENT_TAP={label} COORDS={x},{y}",flush=True)
    adb("shell","input","tap",str(x),str(y))
    ACTIONS[-1]["tap"]={"label":label,"x":x,"y":y}
    time.sleep(3)

def main():
    print("EMULATOR_ANDROID",adb("shell","getprop","ro.build.version.release").strip(),flush=True)
    print("EMULATOR_MODEL",adb("shell","getprop","ro.product.model").strip(),flush=True)
    print("SIM_STATE",adb("shell","getprop","gsm.sim.state").strip(),flush=True)
    print("OPERATOR",adb("shell","getprop","gsm.operator.alpha").strip(),flush=True)
    print("NATIVE_BRIDGE",adb("shell","getprop","ro.dalvik.vm.native.bridge").strip(),flush=True)
    adb("uninstall",PKG,timeout=18)
    adb("logcat","-c")
    install=adb("install",APK,timeout=55)
    print("INSTALL_RESULT",install.strip(),flush=True)
    if "Success" not in install:
        raise RuntimeError("Cannot install target single APK: "+install[:700])
    print("INSTALLED_APK_PATHS",adb("shell","pm","path",PKG).strip(),flush=True)
    print("LAUNCH_RESULT",adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1").strip()[-350:],flush=True)
    time.sleep(16)  # allow Android launcher services to settle after first boot
    seen_error=False
    anr_count=0
    stop_reason="EXHAUSTED_STEPS"
    for i in range(24):
        nodes,visible=snapshot(i)
        joined=" ".join(visible)
        if any(q in joined for q in ("Pixel Launcher isn't responding","System UI isn't responding","Pixel 런처가 응답하지 않습니다","시스템 UI가 응답하지 않습니다")):
            anr_count+=1
            print("EMULATOR_SYSTEM_ANR_OBSERVED",anr_count,flush=True)
            close=choose(nodes,["Close app","앱 닫기","Wait","대기"],True)
            if close:
                tap(close,"CLOSE_EMULATOR_LAUNCHER_ANR")
            adb("shell","am","force-stop","com.google.android.apps.nexuslauncher",timeout=12)
            adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1",timeout=20)
            time.sleep(10)
            if anr_count>=3:
                stop_reason="EMULATOR_SYSTEM_ANR_BLOCKED_TEST"
                break
            continue
        if any(q in joined for q in ERRORS):
            seen_error=True
            print("SERVICE_ERROR_EXACT_UI",joined[:1200],flush=True)
            t=choose(nodes,["앱 종료","확인","닫기","알겠습니다","OK","취소"],True)
            if t:
                tap(t,"DISMISS_EXISTING_SERVICE_ERROR")
                snapshot(i+100)
                time.sleep(5)
                snapshot(i+101)
            stop_reason="SERVICE_ERROR_OBSERVED_AND_DISMISS_TESTED"
            break
        # Chrome Custom Tabs is used during the original app login flow.
        # A clean emulator can open Chrome's own first-run setup instead of the
        # HITEL QA authorization page. Dismiss *browser* onboarding without
        # logging into Google or touching IXIO carrier service agreements.
        chrome_visible=any(node.get("package","")=="com.android.chrome" for node in nodes)
        if chrome_visible:
            browser_setup=choose(nodes,[
                "Use without an account", "계정 없이 사용",
                "Continue without an account", "계정 없이 계속",
                "No thanks", "Not now", "나중에", "사용 안함",
            ],True)
            if browser_setup:
                tap(browser_setup,"CHROME_FIRST_RUN_NO_ACCOUNT")
                continue
        # Do not accept any carrier legal terms or account credentials.
        if any(q in joined for q in CONSENT_BLOCKS):
            print("STOP_BEFORE_TERMS_OR_LOGIN",joined[:850],flush=True)
            stop_reason="LOGIN_OR_TERMS_SCREEN_REACHED"
            break
        action=None
        if any("시작하기" in t for t in visible):
            action=choose(nodes,["시작하기"],True)
        elif "익시오 서비스 이용을 위한" in joined and "권한을 허용해 주세요" in joined:
            action=choose(nodes,["확인"],True)
        else:
            permission_apps=any("permissioncontroller" in node.get("package","").lower() for node in nodes)
            if permission_apps:
                action=choose(nodes,[
                    "앱 사용 중에만 허용","앱 사용 중에만 허용하기","사용 중에만 허용",
                    "허용","이번만 허용","Allow","While using the app",
                    "Allow only while using the app","허용함",
                ],True,require_permission=True)
            if not action:
                action=choose(nodes,[
                    "기본 전화 앱으로 설정","기본 앱으로 설정","다음","계속",
                ],True)
        if action:
            tap(action,action[2])
            continue
        print("NO_SAFE_NAVIGATION_ACTION",flush=True)
        stop_reason="NON_AUTOMATABLE_SCREEN"
        break
    lastpid=adb("shell","pidof",PKG).strip()
    (OUT/"actions.json").write_text(json.dumps(ACTIONS,ensure_ascii=False,indent=2),encoding="utf8")
    log=adb("logcat","-d","-v","threadtime","-t","30000",timeout=30)
    (OUT/"logcat-full.txt").write_text(log,encoding="utf8")
    relevant=[line for line in log.splitlines() if re.search(
        r"(?i)com\.lguplus\.aicallagent|ixio|firebase|carrier|sim|subscription|sign.?up|"
        r"login|auth|failure|exception|security|unsupported|HTTP/|[45]0[0-9]|telephony",line)]
    (OUT/"logcat-filtered.txt").write_text("\n".join(relevant[-2500:]),encoding="utf8")
    fatal=[line for line in log.splitlines() if "FATAL EXCEPTION" in line or
           "Process: com.lguplus.aicallagent" in line or
           "Force finishing activity com.lguplus.aicallagent" in line]
    (OUT/"fatal-only.txt").write_text("\n".join(fatal),encoding="utf8")
    result={"installed":True,"onboarding_safe_taps":sum(bool(x.get("tap")) for x in ACTIONS),
           "service_error_seen":seen_error,"last_pid":lastpid,
           "last_process_alive":bool(lastpid),"fatal_lines":fatal[:20],
           "stop_reason":stop_reason,
           "emulator_launcher_anr_count":anr_count,
           "ui_stages":len(ACTIONS)}
    (OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print("FINAL_DIAGNOSTIC",json.dumps(result,ensure_ascii=False),flush=True)
    for event in relevant[-60:]:
        if re.search(r"(?i)error|security|unavailable|service|signup|registration|subscription|login|auth|permission|fatal",event):
            print("FINAL_RELEVANT_LOGCAT",event[:300],flush=True)
if __name__=="__main__":
    main()
