#!/usr/bin/env python3
"""Actual Android 15 emulator test of manually selected capture target.
The target must NOT be launched and must remain visibly selected.
No telephony call/audio-stream claims are made by this UI test.
"""
import subprocess, re, time, pathlib, xml.etree.ElementTree as ET

APP="app.hitel.callflowlab.v14.speakerselect"
OUT=pathlib.Path("/tmp/hitel14-v21-picker")
OUT.mkdir(parents=True,exist_ok=True)
def call(*args,timeout=80,required=True):
    r=subprocess.run(list(args),text=True,stdout=subprocess.PIPE,
      stderr=subprocess.STDOUT,timeout=timeout,errors="replace")
    if required and r.returncode:
        raise RuntimeError("cmd="+str(args)+" code="+str(r.returncode)+
                           "\n"+r.stdout[-1800:])
    return r.stdout
def adb(*args,**k):return call("adb",*args,**k)
def image(tag):
    with open(OUT/(tag+".png"),"wb") as f:
        p=subprocess.run(["adb","exec-out","screencap","-p"],
             stdout=f,stderr=subprocess.PIPE,timeout=40)
        assert p.returncode==0,p.stderr.decode()[:200]
def hierarchy(tag):
    status=adb("shell","uiautomator","dump","/data/local/tmp/window.xml",
               timeout=55,required=False)
    content=adb("exec-out","cat","/data/local/tmp/window.xml",
                timeout=20,required=False)
    if "<hierarchy" not in content:
        content=adb("exec-out","uiautomator","dump","/dev/tty",
                    timeout=55,required=False)
    match=re.search(r"<hierarchy\b.*?</hierarchy>",content,re.S)
    if not match:
        raise RuntimeError("Cannot read Android UI hierarchy dump. "+
                           "status="+status[-400:]+" content="+content[-300:])
    (OUT/(tag+".xml")).write_text(match.group(0))
    return ET.fromstring(match.group(0))
def locate(term,stage):
    root=hierarchy(stage)
    for node in root.iter("node"):
        attrs=node.attrib
        if term in attrs.get("text","") or term in attrs.get("content-desc",""):
            bounds=attrs.get("bounds","")
            m=re.findall(r"\d+",bounds)
            if len(m)==4:
                x,y,xx,yy=map(int,m)
                return ((x+xx)//2,(y+yy)//2,attrs.get("text",""))
    return None
def tap(term,tag):
    for trial in range(3):
        where=locate(term,tag+"_"+str(trial))
        if where:
            x,y,label=where
            print("UI_CLICK",term,x,y,label,flush=True)
            adb("shell","input","tap",str(x),str(y))
            time.sleep(1.4)
            return
        time.sleep(1)
    raise AssertionError("Android UI control not found: "+term)
def tap_row(term,tag):
    # Click ONLY a real row in the AlertDialog ListView. Do not accidentally
    # click the EditText search value or the "current selected" summary label.
    for attempt in range(3):
        root=hierarchy(tag+"_"+str(attempt))
        candidates=[]
        for element in root.iter("node"):
            if element.attrib.get("class")!="android.widget.ListView":
                continue
            for child in element.iter("node"):
                if child is element:continue
                if child.attrib.get("class")!="android.widget.TextView":continue
                t=child.attrib.get("text","")
                if term not in t:continue
                bounds=re.findall(r"\d+",child.attrib.get("bounds",""))
                if len(bounds)==4:
                    x,y,xx,yy=map(int,bounds)
                    candidates.append(((x+xx)//2,(y+yy)//2,t))
        if candidates:
            x,y,label=candidates[0]
            print("LIST_ROW_CLICK",term,x,y,label,flush=True)
            adb("shell","input","tap",str(x),str(y))
            time.sleep(1.6)
            return
        rows=[x.attrib.get("text","") for listNode in root.iter("node")
              if listNode.attrib.get("class")=="android.widget.ListView"
              for x in listNode.iter("node") if x.attrib.get("text")]
        print("SEARCH_RESULT_ROWS",rows[:15],flush=True)
        time.sleep(1)
    raise AssertionError("ListView does not contain expected package: "+term)
def target_launch_safe():
    stack=adb("shell","dumpsys","activity","activities")
    top="\n".join(line for line in stack.splitlines()
            if "topResumedActivity=" in line or "mResumedActivity:" in line)
    print("TOP_ACTIVITY",top[-450:],flush=True)
    assert APP in top,"Android launched another app unexpectedly: "+top
def prefs():
    result=adb("shell","run-as",APP,"cat",
               "shared_prefs/hitel_output_capture_target.xml",
               required=False)
    return result

APK="AndroidProject/app/build/outputs/apk/debug/app-debug.apk"
print("EMULATOR_API",adb("shell","getprop","ro.build.version.sdk").strip(),flush=True)
print("INSTALL",adb("install","-r",APK,timeout=120).strip(),flush=True)
print("LAUNCH",adb("shell","am","start","-W","-n",
      APP+"/app.hitel.samsungprobe.W03ConsoleActivity",timeout=70).strip()[-500:],flush=True)
time.sleep(6)
assert adb("shell","pidof",APP).strip(),"APP exited after launch"
image("w03-first")
print("PASS_W03_ACTIVITY_RUNNING",flush=True)
target_launch_safe()
tap("출력음 캡처 대상 선택·변경","w03-select")
image("selector-open")
assert locate("앱 이름 또는 패키지 검색","filter-exists"),"search field missing"
assert locate("전체 앱","all-mode-visible"),"all capture source choice missing"
print("PASS_CHOOSER_OPENED_WITHOUT_LAUNCHING_SOURCE_APP",flush=True)
target_launch_safe()
tap_row("전체 앱 (UID 필터 없음)","select-all")
image("all-selected")
assert locate("현재 선택","selected-summary"),"current selection not visible"
print("PASS_SELECTED_TARGET_CURRENTLY_VISIBLE",flush=True)
tap("출력음 캡처 대상 선택·변경","reselect")
tap("앱 이름 또는 패키지 검색","search")
adb("shell","input","text","HITEL14")
time.sleep(2)
image("picker-filtered")
tap_row(APP,"select-own-app")
time.sleep(2)
image("own-app-selected")
selected=prefs()
(OUT/"selection-prefs.xml").write_text(selected)
print("PERSISTED_SELECTED_PACKAGE_XML",selected[:1000],flush=True)
assert 'app.hitel.callflowlab.v14.speakerselect' in selected,selected
assert locate("현재 선택","own-app-selection-summary")
target_launch_safe()
print("PASS_TARGET_CHANGED_PERSISTED_AND_NO_TARGET_APP_LAUNCH",flush=True)
tap("출력음 캡처 대상 선택·변경","choose-again")
tap_row("전체 앱 (UID 필터 없음)","change-to-all")
after=prefs()
assert 'selected_package' in after and 'value=""' in after,after
target_launch_safe()
image("all-reselected")
print("PASS_SWITCH_SELECTED_APP_BACK_TO_ALL_WITHOUT_LAUNCH",flush=True)
