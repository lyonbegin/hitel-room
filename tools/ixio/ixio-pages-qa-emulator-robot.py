#!/usr/bin/env python3
"""Automatically operate the REAL IXIO APK in a disposable Android emulator.

Captures every screenshot and UI hierarchy, taps Start/OK/Android runtime
permissions, navigates original login flow, and logs the very first failure.
Uses only the isolated HITEL synthetic login test account. Never enters real
phone/account credentials, grants a carrier subscription, or fabricates tokens.
"""
from __future__ import annotations
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT=Path("ixio-pages-qa-emulator-evidence")
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
    # Exactly the role requested by the original recorder onboarding.
    # This is a disposable test emulator, not the user's real phone.
    role_grant=adb("shell","cmd","role","add-role-holder",
                   "android.app.role.DIALER",PKG,timeout=30)
    print("IXIO_TEST_DEFAULT_DIALER_ROLE_COMMAND",role_grant.strip()[:350],flush=True)
    role_holders=adb("shell","cmd","role","get-role-holders",
                     "android.app.role.DIALER",timeout=25)
    print("IXIO_TEST_DEFAULT_DIALER_ROLE_HOLDERS",role_holders.strip()[:350],flush=True)
    print("LAUNCH_RESULT",adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1").strip()[-350:],flush=True)
    time.sleep(16)  # allow Android launcher services to settle after first boot
    seen_error=False
    error_screens=[]
    alternate_login_attempts=0
    anr_count=0
    chrome_welcome_retries=0
    blank_screen_retries=0
    home_screen_seen=False
    pages_custom_tab_taps=0
    recorder_setup_prompt_seen=False
    recorder_setup_taps=0
    home_recorder_prompt_waits=0
    recorder_fallback_launches=0
    stop_reason="EXHAUSTED_STEPS"
    for i in range(36):
        nodes,visible=snapshot(i)
        joined=" ".join(visible)
        if not visible:
            # AppAuth/Chrome Custom Tab -> IXIO activity handoff may present
            # a transient fully blank accessibility hierarchy while async
            # post-login config/terms requests complete. A single 3-second
            # capture is not evidence that IXIO is permanently blocked.
            blank_screen_retries += 1
            activity=adb("shell","dumpsys","activity","activities",timeout=14)
            focus=next((line.strip()[:300] for line in activity.splitlines()
                        if "topResumedActivity" in line or "mResumedActivity" in line),"unknown")
            print("BLANK_UI_HANDOFF_OBSERVED",blank_screen_retries,
                  "FOCUS",focus,flush=True)
            if blank_screen_retries <= 8:
                time.sleep(7)
                continue
            stop_reason="BLANK_UI_HANDOFF_TIMEOUT_AFTER_56_SECONDS"
            break
        blank_screen_retries=0
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
        # Distinguish a genuine IXIO home screen from an onboarding or
        # Chrome placeholder. These labels were observed together in the
        # two-original-APK emulator run (43876014433).
        if all(label in joined for label in ("최근 기록", "연락처", "키패드", "디스커버")):
            home_screen_seen=True
            print("IXIO_AUTHENTICATED_HOME_SCREEN_OBSERVED",flush=True)
            if (not recorder_setup_prompt_seen and
                    not ("통화 녹음 및 AI 기능 사용을 위해" in joined and
                         "설정을 완료해 주세요" in joined)):
                # The recorder setup banner is asynchronously mounted
                # after home tabs. The earlier run 43897982998 exited on
                # first home UI snapshot before the banner appeared.
                home_recorder_prompt_waits += 1
                print("IXIO_HOME_RECORDER_BANNER_LOADING",
                      home_recorder_prompt_waits,flush=True)
                if home_recorder_prompt_waits <= 5:
                    time.sleep(5)
                    continue
                if recorder_fallback_launches == 0:
                    recorder_fallback_launches += 1
                    launch=adb("shell","monkey","-p",
                               "com.lguplus.callrecorder",
                               "-c","android.intent.category.LAUNCHER","1",timeout=22)
                    print("IXIO_RECORDER_FALLBACK_DIRECT_LAUNCH",
                          launch[-260:],flush=True)
                    time.sleep(7)
                    continue
        if ("통화 녹음 및 AI 기능 사용을 위해" in joined and
                "익시오 통화녹음" in joined and "설정을 완료해 주세요" in joined):
            recorder_setup_prompt_seen=True
            # Exact observed clickable child: TextView '설정' at [910,498][964,546].
            # Never press the identically labeled bottom tab at y>=2190.
            # Reuse verified choose() bounds parser; compare the y coordinate
            # to distinguish the banner (y~522) from bottom tab (y~2260).
            banner_setup=choose(nodes,["설정"],exact=True)
            banner_setup=(banner_setup
                          if banner_setup and 300 <= banner_setup[1] <= 900
                          else None)
            if recorder_setup_taps >= 2:
                print("RECORDER_SETUP_PROMPT_STILL_PRESENT_AFTER_TWO_TAPS",flush=True)
                stop_reason="RECORDER_SETUP_SCREEN_REMAINS_UNCONFIGURED"
                break
            if banner_setup:
                recorder_setup_taps+=1
                tap(banner_setup,"OPEN_ORIGINAL_RECORDER_COMPANION_SETUP")
                continue
            stop_reason="RECORDER_SETUP_PROMPT_WITHOUT_BUTTON"
            break
        # Original recorder requests Android's "unused-app permission deletion"
        # opt-out. Match the original consent screen exactly on this disposable
        # emulator and apply only the corresponding Android app-op (not app code).
        if "사용하지 않는 앱 권한 삭제" in joined and "익시오 통화녹음" in joined:
            adb("shell","cmd","appops","set","com.lguplus.callrecorder",
                "AUTO_REVOKE_PERMISSIONS_IF_UNUSED","ignore",timeout=25)
            status=adb("shell","cmd","appops","get","com.lguplus.callrecorder",
                       "AUTO_REVOKE_PERMISSIONS_IF_UNUSED",timeout=25)
            print("ORIGINAL_RECORDER_AUTO_REVOKE_STATUS",status.strip()[:500],flush=True)
            if "ignore" not in status:
                stop_reason="RECORDER_ANDROID_UNUSED_APP_PERMISSION_SETTING_FAILED"
                break
            button=choose(nodes,["닫기"],True)
            if button:
                tap(button,"DISMISS_RECORDER_UNUSED_APP_PERMISSION_PROMPT_AFTER_SET")
                continue
            stop_reason="RECORDER_UNUSED_APP_PERMISSION_PROMPT_CANNOT_DISMISS"
            break
        if any(q in joined for q in ERRORS):
            seen_error=True
            error_screens.append({"stage":f"stage-{i:02d}", "text":joined[:900]})
            print("FIRST_FAILURE_SCREEN_CAPTURED",f"stage-{i:02d}",joined[:1100],flush=True)
            screenshot("first-failure-undismissed")
            # A documented alternate-login affordance may still lead to the
            # existing HITEL OAuth flow. Probe it ONCE after saving evidence.
            # Never touch "앱 종료" or dismiss unknown errors.
            other_login=choose(nodes,["다른 아이디로 로그인"],True)
            if other_login and alternate_login_attempts==0:
                alternate_login_attempts+=1
                tap(other_login,"TRY_EXISTING_ALTERNATE_LOGIN_BUTTON_ONCE")
                continue
            stop_reason="FIRST_SERVICE_ERROR_PRESERVED_FOR_ANALYSIS"
            break
        # Chrome Custom Tabs is used during the original app login flow.
        # A clean emulator can open Chrome's own first-run setup instead of the
        # HITEL QA authorization page. Dismiss *browser* onboarding without
        # logging into Google or touching IXIO carrier service agreements.
        chrome_visible=(any(node.get("package","")=="com.android.chrome" for node in nodes)
                        or "Welcome to Chrome" in joined)
        if chrome_visible:
            browser_setup=choose(nodes,[
                "Use without an account", "계정 없이 사용",
                "Continue without an account", "계정 없이 계속",
                "No thanks", "Not now", "나중에", "사용 안함",
            ],True)
            if browser_setup:
                tap(browser_setup,"CHROME_FIRST_RUN_NO_ACCOUNT")
                continue
            if "Welcome to Chrome" in joined:
                chrome_welcome_retries+=1
                print("CHROME_FIRST_RUN_LOADING",chrome_welcome_retries,flush=True)
                if chrome_welcome_retries<=6:
                    time.sleep(5)
                    continue
                stop_reason="CHROME_FIRST_RUN_STALLED"
                break
        # Real 2026-11-20 Android14 Pixel6 screenshot evidence:
        # Chrome Custom Tab accessibility exposes ONLY the browser toolbar
        # (title + GitHub Pages domain), not its HTML button. Screenshot run
        # 44732747521, stage-05.png, confirmed the blue QA login button at
        # x=540,y≈1030 on a 1080x2400 screen. No terms or hang-up nearby.
        if ("HITEL IXIO 테스트 로그인" in joined and
                "lyonbegin.github.io" in joined and
                pages_custom_tab_taps < 1):
            image=OUT/f"stage-{i:02d}.png"
            safe=False
            if image.exists():
                import struct
                raw=image.read_bytes()[:24]
                safe=(raw.startswith(bytes.fromhex("89504e470d0a1a0a")) and
                      struct.unpack(">II",raw[16:24])==(1080,2400))
            if safe:
                pages_custom_tab_taps+=1
                tap((540,1030,"GitHub Pages QA only"),
                    "PAGES_QA_ONLY_COMPLETE_AND_DEEP_LINK_BACK")
                continue
            print("PAGES_QA_CCT_SCREEN_SIZE_MISMATCH",flush=True)
            stop_reason="PAGES_QA_CCT_SCREEN_NOT_VERIFIED"
            break
        # The offline GitHub Pages test page is not a carrier account consent.
        # Click its sole explicit QA completion button; original app validates
        # the returned state/deep link. Do not auto-accept unrelated terms.
        if "HITEL IXIO 시험 로그인" in joined:
            action=choose(nodes,["시험 로그인 완료 · 익시오로 복귀"],True)
            if action:
                tap(action,"PAGES_QA_ONLY_COMPLETE_AND_DEEP_LINK_BACK")
                continue
            print("PAGES_QA_LOGIN_PAGE_PRESENT_BUT_BUTTON_NOT_FOUND",joined[:600],flush=True)
            stop_reason="PAGES_QA_BUTTON_MISSING"
            break
        # Do not accept any carrier legal terms or account credentials.
        if any(q in joined for q in CONSENT_BLOCKS):
            print("STOP_BEFORE_TERMS_OR_LOGIN",joined[:850],flush=True)
            stop_reason="LOGIN_OR_TERMS_SCREEN_REACHED"
            break
        action=None
        # The recorder companion explicitly asks Android for battery
        # optimization exemption so its foreground recording service survives.
        # This system dialog is from Settings, not PermissionController.
        if "Let app always run in background?" in joined and "익시오 통화녹음" in joined:
            action=choose(nodes,["Allow"],True)
        if not action and "전화 받을 앱을" in joined and "익시오로 설정해주세요" in joined:
            action=choose(nodes,["설정"],True)
        if not action and "통화 녹음 앱 이용 시 주의 사항" in joined:
            action=choose(nodes,["확인"],True)
        if not action and any("시작하기" in t for t in visible):
            action=choose(nodes,["시작하기"],True)
        elif (("익시오 서비스 이용을 위한" in joined or
               "익시오 통화녹음 서비스 이용을 위한" in joined) and
              "권한을 허용해 주세요" in joined):
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
    recorder_pid=adb("shell","pidof","com.lguplus.callrecorder").strip()
    print("IXIO_RECORDER_PROCESS_AFTER_ONBOARDING",recorder_pid or "NOT_RUNNING",flush=True)
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
           "service_error_seen":seen_error,"error_screens":error_screens,
           "alternate_login_attempts":alternate_login_attempts,
           "pages_custom_tab_taps":pages_custom_tab_taps,"last_pid":lastpid,
           "last_process_alive":bool(lastpid),"fatal_lines":fatal[:20],
           "stop_reason":stop_reason,
           "emulator_launcher_anr_count":anr_count,
           "ui_stages":len(ACTIONS),
           "home_screen_seen":home_screen_seen,
           "recorder_process_pid":recorder_pid,
           "recorder_process_alive":bool(recorder_pid),
           "default_dialer_role_holder":PKG in role_holders.split(),
           "recorder_setup_prompt_seen":recorder_setup_prompt_seen,
           "recorder_setup_button_taps":recorder_setup_taps,
           "home_recorder_prompt_waits":home_recorder_prompt_waits,
           "recorder_fallback_launches":recorder_fallback_launches}
    (OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print("FINAL_DIAGNOSTIC",json.dumps(result,ensure_ascii=False),flush=True)
    for event in relevant[-60:]:
        if re.search(r"(?i)error|security|unavailable|service|signup|registration|subscription|login|auth|permission|fatal",event):
            print("FINAL_RELEVANT_LOGCAT",event[:300],flush=True)
if __name__=="__main__":
    main()
