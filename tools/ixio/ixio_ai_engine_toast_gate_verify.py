#!/usr/bin/env python3
"""Exercise original AI update and recording setting UI after the QA gate patch."""
from pathlib import Path
import importlib.util,json,time,re
spec=importlib.util.spec_from_file_location("ixio_robot","tools/ixio/ixio-pages-qa-emulator-robot.py")
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
r.OUT=Path("ixio-pages-qa-results/toast-gate-ui");r.OUT.mkdir(parents=True,exist_ok=True)
step=700
def snap():
    global step
    step+=1
    return r.snapshot(step)
result={"recording_setting_clicked":False,"recording_settings_opened":False,
        "recording_switch_on":False,"engine_update_clicked":False}
r.adb("logcat","-c")
# The original onboarding robot ended in Settings. Return its list to the top.
for _ in range(4):
    r.adb("shell","input","swipe","540","570","540","1830","350")
    time.sleep(.6)
nodes,visible=snap()
update=r.choose(nodes,["업데이트"],exact=True)
if update:
    result["engine_update_clicked"]=True
    r.tap(update,"ORIGINAL_AI_ENGINE_UPDATE_AFTER_PUBLIC_CATALOG_FIX")
    time.sleep(5)
    nodes,visible=snap()
    button=r.choose(nodes,["다운로드","지금 다운로드","확인"],exact=True)
    if button:
        r.tap(button,"ORIGINAL_MODEL_DOWNLOAD_CONFIRM")
        time.sleep(10)
        nodes,visible=snap()
    # Close only a visible download dialog before original recording setting.
    close=r.choose(nodes,["닫기","완료"],exact=True)
    if close:r.tap(close,"CLOSE_FINISHED_ORIGINAL_DOWNLOAD_DIALOG")
nodes,visible=snap()
entry=r.choose(nodes,["통화 녹음"],exact=True)
if not entry:
    tab=r.choose(nodes,["설정"],exact=True)
    if tab:r.tap(tab,"RETURN_ORIGINAL_SETTINGS_TAB")
    for _ in range(3):
        r.adb("shell","input","swipe","540","570","540","1830","350")
        time.sleep(.5)
    nodes,visible=snap();entry=r.choose(nodes,["통화 녹음"],exact=True)
if entry:
    result["recording_setting_clicked"]=True
    r.tap(entry,"OPEN_ORIGINAL_CALL_RECORD_SETTING_PAST_VAS_TOAST")
    time.sleep(4);nodes,visible=snap()
joined=" ".join(visible)
result["visible_after_recording_click"]=visible[:60]
result["recording_settings_opened"]=(
    result["recording_setting_clicked"] and
    any(s in joined for s in ["통화 자동 녹음","자동 녹음","녹음 알림","녹음 파일 형식","녹음한 통화","모든 통화"])
)
# Operate only a real visible Android switch; never force a stored success flag.
switches=[n for n in nodes if "Switch" in n.get("class","") and
          n.get("checkable")=="true" and n.get("enabled")=="true"]
if result["recording_settings_opened"] and switches:
    node=switches[0]
    if node.get("checked")!="true":
        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",node.get("bounds",""))
        if m:
            a,b,c,d=map(int,m.groups())
            r.tap(((a+c)//2,(b+d)//2,"original recording switch"),"TURN_ON_ORIGINAL_RECORDING_SWITCH")
            time.sleep(3);nodes,visible=snap()
    result["recording_switch_on"]=any("Switch" in n.get("class","") and n.get("checked")=="true" for n in nodes)
log=r.adb("logcat","-d","-v","threadtime",timeout=30)
(r.OUT/"logcat.txt").write_text(log,encoding="utf-8")
result["gate_trace"]=[x[-500:] for x in log.splitlines() if "IXIO_QA_GATE" in x]
result["fatal_seen"]="FATAL EXCEPTION" in log
result["model_auth_401_count"]=sum("AUTH_CATALOG" in x and "WIRE_RESPONSE=401" in x for x in log.splitlines())
result["permission_toast_only_hidden"]=False
result["stt_verified"]=False
Path("ixio-pages-qa-results/toast-gate-ui-result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print("AI_ENGINE_RECORDING_TOAST_GATE_UI_RESULT",json.dumps(result,ensure_ascii=False),flush=True)
assert result["recording_setting_clicked"],"Original recording row could not be exercised"
assert result["recording_settings_opened"],"Recording settings still blocked after click"
assert not result["fatal_seen"],"App crashed during actual recording settings test"
# Restore original main app before the existing GSM smoke test.
r.adb("shell","monkey","-p",r.PKG,"-c","android.intent.category.LAUNCHER","1")
