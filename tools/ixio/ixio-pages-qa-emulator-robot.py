#!/usr/bin/env python3
"""Automatically operate the REAL IXIO APK in a disposable Android emulator.

Captures every screenshot and UI hierarchy, taps Start/OK/Android runtime
permissions, navigates original login flow, and logs the very first failure.
Uses only the isolated HITEL synthetic login test account. Never enters real
phone/account credentials, grants a carrier subscription, or fabricates tokens.
"""
from __future__ import annotations
import json
import os
import sys
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
    row_test=os.environ.get("HITEL_QA_RECORDING_ROW_TEST")=="1"
    # Disposable emulator only: grant declared Android runtime permissions on install.
    # No application entitlement, carrier account, signature permission or state is changed.
    install=adb("install",*(["-g"] if row_test else []),APK,timeout=55)
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
    pages_custom_tab_waits=0
    recorder_setup_prompt_seen=False
    recorder_setup_taps=0
    home_recorder_prompt_waits=0
    recorder_fallback_launches=0
    recorder_settings_seen=False
    recorder_settings_back_once=False
    model_download_prompt_seen=False
    model_download_button_taps=0
    home_after_recorder_waits=0
    main_settings_tab_opened=False
    model_settings_entry_taps=0
    settings_vas_retry_taps=0
    settings_scroll_count=0
    emulator_app_relaunch_attempts=0
    qa_log_buttons_verified=False
    repeated_permission_intro=0
    row_home_waits=0
    stop_reason="EXHAUSTED_STEPS"
    for i in range(50):
        nodes,visible=snapshot(i)
        joined=" ".join(visible)
        if row_test:
            intro="권한을 허용해 주세요" in joined and "익시오 서비스 이용을 위한" in joined
            repeated_permission_intro=repeated_permission_intro+1 if intro else 0
            if repeated_permission_intro>=3:
                for package in (PKG,"com.lguplus.callrecorder"):
                    (OUT/f"permission-loop-{package}.txt").write_text(adb("shell","dumpsys","package",package,timeout=25),encoding="utf8")
                print("PERMISSION_INTRO_REPEATED_AFTER_RUNTIME_GRANTS",flush=True)
                stop_reason="PERMISSION_INTRO_LOOP"
                break
            # Stop at the original settings row, not at the unrelated AI-model menu.
            row_labels={"통화 녹음","통화녹음","통화 자동 녹음","통화 녹음 설정"}
            if main_settings_tab_opened and any(x in row_labels for x in visible):
                print("ORIGINAL_RECORDING_ROW_SCREEN_REACHED",flush=True)
                stop_reason="RECORDING_ROW_SCREEN_REACHED"
                break
            if all(x in joined for x in ("최근 기록","연락처","키패드","디스커버")) and not ("통화 녹음 및 AI 기능 사용을 위해" in joined and "설정을 완료해 주세요" in joined):
                home_screen_seen=True
                row_home_waits+=1
                if row_home_waits<=2:
                    time.sleep(5)
                    continue
                settings_nodes=[n for n in nodes if (n.get("text","")+" "+n.get("content-desc","")).strip()=="설정"]
                candidates=[choose([n],["설정"]) for n in settings_nodes]
                candidates=[n for n in candidates if n]
                if candidates:
                    main_settings_tab_opened=True
                    tap(max(candidates,key=lambda x:x[1]),"OPEN_BOTTOM_SETTINGS_FOR_REAL_ROW_TEST")
                    continue
            if main_settings_tab_opened:
                if settings_scroll_count<3:
                    settings_scroll_count+=1
                    adb("shell","input","swipe","540","1790","540","525","500")
                    time.sleep(3)
                    continue
                stop_reason="RECORDING_ROW_NOT_VISIBLE"
                break
        # QA-only: verify the log clear/copy buttons at the STABLE first
        # onboarding screen, not during the transient blank OAuth callback.
        # Other IXIO test workflows never set this environment variable.
        if (os.environ.get("HITEL_QA_LOG_BUTTON_TEST")=="1"
                and not qa_log_buttons_verified
                and "시작하기" in joined
                and "HITEL 진단 로그 열기" in joined):
            print("VERIFY_LOG_CLEAR_COPY_ON_STABLE_ORIGINAL_START_SCREEN",flush=True)
            subprocess.run([sys.executable,"tools/ixio/qa_debug/verify_log_buttons.py"],
                           check=True,timeout=110)
            qa_log_buttons_verified=True
            print("QA_LOG_BUTTONS_VERIFIED_ON_FIRST_SCREEN",flush=True)
            time.sleep(2)
            continue
        # On a fresh emulator, launcher may remain foreground even though
        # PackageManager installed the app and granted default dialer. Preserve
        # evidence and retry the ORIGINAL launcher intent at most twice.
        if ("Predicted app: 익시오" in joined and
                not adb("shell","pidof",PKG).strip()):
            if emulator_app_relaunch_attempts < 2:
                emulator_app_relaunch_attempts+=1
                details=adb("logcat","-d","-v","threadtime","-t","4000",timeout=25)
                (OUT/f"emulator-launch-retry-{emulator_app_relaunch_attempts}.log").write_text(
                    details,encoding="utf8")
                command=adb("shell","monkey","-p",PKG,
                            "-c","android.intent.category.LAUNCHER","1",timeout=30)
                print("ORIGINAL_IXIO_LAUNCHER_RETRY",
                      emulator_app_relaunch_attempts,command[-300:],flush=True)
                time.sleep(12)
                continue
            print("ORIGINAL_IXIO_NOT_LAUNCHED_AFTER_TWO_RETRIES",flush=True)
            stop_reason="APP_NOT_STARTED_AFTER_LAUNCH_RETRIES"
            break
        # HITEL QA places a persistent "로그" floating button on each
        # original Activity. During AppAuth callback the entire *real*
        # IXIO content can still be blank, leaving only that overlay.
        # Treat this exactly like an empty transitional UI rather than
        # declaring that the handoff is non-automatable.
        diagnostic_overlay_only=(bool(visible) and all(
            "HITEL 진단 로그 열기" in item and "로그" in item for item in visible))
        if not visible or diagnostic_overlay_only:
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
        # Continue past the original recorder's already-configured settings screen.
        # This uses the visible back navigation; no recording, STT or policy code is patched.
        if ("통화 자동 녹음" in joined and "익시오 통화녹음 앱" in joined
                and "사용 중" in joined):
            recorder_settings_seen=True
            if not recorder_settings_back_once:
                recorder_settings_back_once=True
                print("ORIGINAL_RECORDER_SETTINGS_CONFIRMED_USED_AND_BACK_TO_MAIN",flush=True)
                adb("shell","input","keyevent","4")
                time.sleep(6)
                continue
            print("ORIGINAL_RECORDER_SETTINGS_RETURNED_AFTER_BACK",flush=True)
            stop_reason="RECORDER_SETTINGS_NAVIGATION_LOOP"
            break
        # A real Wi-Fi warning is a supported original UI state. Dismiss it
        # with its own Later button; never set model/network success flags.
        if "Wi-Fi를 연결해 주세요" in joined:
            later=choose(nodes,["나중에"],True)
            if later:
                tap(later,"ORIGINAL_WIFI_DOWNLOAD_WARNING_LATER")
                time.sleep(2)
                continue
        # The original app owns its model download and status UI. Only tap an
        # explicit model/engine-download button on a real visible model prompt.
        # Never impersonate a model as downloaded, bypass an authorization error,
        # or substitute data for the real URL supplied by the original catalog.
        if (("모델" in joined or "AI 엔진" in joined)
                and "다운로드" in joined):
            model_download_prompt_seen=True
            print("ORIGINAL_MODEL_DOWNLOAD_UI_OBSERVED",f"stage-{i:02d}",joined[:1000],flush=True)
            if model_download_button_taps==0:
                opt=choose(nodes,[
                    "AI 모델 다운로드","AI 엔진 다운로드","모델 다운로드",
                    "다운로드 시작","지금 다운로드","모두 다운로드","다운로드"
                ],True)
                if opt:
                    model_download_button_taps+=1
                    tap(opt,"TRIGGER_ONLY_ORIGINAL_MODEL_DOWNLOAD_UI")
                    time.sleep(5)
                    continue
        # The original Recent Calls screen may asynchronously check AI model
        # status after recorder setup, so do not abandon it immediately.
        if (recorder_settings_back_once and not main_settings_tab_opened
                and all(x in joined for x in ("최근 기록", "연락처", "키패드", "디스커버"))):
            if home_after_recorder_waits < 3:
                home_after_recorder_waits+=1
                print("WAIT_ORIGINAL_MODEL_CHECK_AFTER_RECORDER_SETUP",
                      home_after_recorder_waits,flush=True)
                time.sleep(7)
                continue
            settings=choose(nodes,["설정"],exact=True)
            if settings and settings[1] >= 1600:
                main_settings_tab_opened=True
                tap(settings,"OPEN_EXISTING_IXIO_SETTINGS_AFTER_RECORDER_SETUP")
                continue
            print("IXIO_BOTTOM_SETTINGS_TAB_NOT_FOUND",flush=True)
            stop_reason="ORIGINAL_SETTINGS_TAB_MISSING"
            break
        # Navigate only an actual visible settings entry for original AI models.
        if main_settings_tab_opened and model_settings_entry_taps==0:
            entry=choose(nodes,[
                "AI 모델 다운로드","AI 엔진 다운로드","AI 모델 관리","AI 엔진 관리",
                "AI 모델 업데이트","AI 엔진 업데이트","모델 다운로드",
                "AI 모델","AI 엔진",
            ],exact=True)
            if entry:
                model_settings_entry_taps+=1
                tap(entry,"OPEN_VISIBLE_ORIGINAL_AI_MODEL_SETTINGS")
                continue
        # The actual original Settings screen may load service membership
        # data unsuccessfully. Use its own retry button ONCE to identify the
        # next failure, then scroll to seek the original AI model/download UI.
        # No fabricated carrier subscription or model installation state.
        if main_settings_tab_opened and model_settings_entry_taps==0:
            if ("부가서비스 이용 정보를 불러오지 못했어요" in joined
                    and settings_vas_retry_taps==0):
                retry=choose(nodes,["다시 시도"],exact=True)
                if retry:
                    settings_vas_retry_taps+=1
                    tap(retry,"RETRY_ONLY_ORIGINAL_VAS_INFO_REQUEST_ONCE")
                    time.sleep(6)
                    continue
            if settings_scroll_count<3:
                settings_scroll_count+=1
                print("SCROLL_ORIGINAL_IXIO_SETTINGS_FOR_MODEL_MENU",
                      settings_scroll_count,flush=True)
                adb("shell","input","swipe","540","1790","540","525","500")
                time.sleep(4)
                continue
            print("ORIGINAL_SETTINGS_NO_MODEL_DOWNLOAD_ITEM_AFTER_THREE_SCROLLS",
                  flush=True)
            stop_reason="ORIGINAL_SETTINGS_NO_MODEL_DOWNLOAD_ENTRY_VISIBLE"
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
        # Prefer the real HTML button whenever accessibility exposes it.
        # The old title still says '테스트 로그인', while the HTML heading says
        # '시험 로그인'; both are present after a Chrome translation refresh.
        if ("HITEL IXIO" in joined and "lyonbegin.github.io" in joined
                and pages_custom_tab_taps < 3):
            action=choose(nodes,["시험 로그인 완료 · 익시오로 복귀"],True)
            if action:
                pages_custom_tab_taps+=1
                tap(action,"PAGES_QA_ONLY_COMPLETE_AND_DEEP_LINK_BACK")
                time.sleep(3)
                continue
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
        # After clicking the static OAuth QA button, give the Android AppAuth
        # deep-link dispatch time to return to IXIO. Never click repeatedly.
        if "HITEL IXIO 테스트 로그인" in joined and pages_custom_tab_taps>=1:
            pages_custom_tab_waits+=1
            print("PAGES_OAUTH_DEEP_LINK_HANDOFF_WAIT",
                  pages_custom_tab_waits,flush=True)
            if pages_custom_tab_waits<=6:
                time.sleep(5)
                continue
            stop_reason="PAGES_OAUTH_DID_NOT_RETURN_TO_APP"
            break
        # The offline GitHub Pages test page is not a carrier account consent.
        # Click its sole explicit QA completion button; original app validates
        # the returned state/deep link. Do not auto-accept unrelated terms.
        if "HITEL IXIO 시험 로그인" in joined:
            action=choose(nodes,["시험 로그인 완료 · 익시오로 복귀"],True)
            if action:
                pages_custom_tab_taps+=1
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
    model_worker_started=[line for line in log.splitlines()
                          if re.search(r"(?i)WM-WorkerWrapper.*Starting work.*(?:model|download)",line)]
    model_download_service_events=[line for line in log.splitlines()
                                   if re.search(r"(?i)AiModelDownloadService|AiModelUpdateRepository|DownloadFileWorker|FileUnzipWorker",line)]
    print("ORIGINAL_MODEL_DOWNLOAD_WORKER_STARTED_COUNT",len(model_worker_started),flush=True)
    print("ORIGINAL_MODEL_DOWNLOAD_SERVICE_LOG_EVENT_COUNT",len(model_download_service_events),flush=True)
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
           "recorder_fallback_launches":recorder_fallback_launches,
           "recorder_settings_seen":recorder_settings_seen,
           "recorder_settings_back_once":recorder_settings_back_once,
           "model_download_prompt_seen":model_download_prompt_seen,
           "model_download_button_taps":model_download_button_taps,
           "model_download_worker_started_count":len(model_worker_started),
           "model_download_service_log_event_count":len(model_download_service_events),
           "home_after_recorder_waits":home_after_recorder_waits,
           "main_settings_tab_opened":main_settings_tab_opened,
           "model_settings_entry_taps":model_settings_entry_taps,
           "settings_vas_retry_taps":settings_vas_retry_taps,
           "settings_scroll_count":settings_scroll_count,
           "emulator_app_relaunch_attempts":emulator_app_relaunch_attempts}
    (OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print("FINAL_DIAGNOSTIC",json.dumps(result,ensure_ascii=False),flush=True)
    for event in relevant[-60:]:
        if re.search(r"(?i)error|security|unavailable|service|signup|registration|subscription|login|auth|permission|fatal",event):
            print("FINAL_RELEVANT_LOGCAT",event[:300],flush=True)
if __name__=="__main__":
    main()
