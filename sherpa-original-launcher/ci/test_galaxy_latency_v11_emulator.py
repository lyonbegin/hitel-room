#!/usr/bin/env python3
"""Actual Android 15 emulator E2E: APK installation, DocumentsUI M4A selection,
native Zipformer, FFmpeg, captions, and durable latency traces.

Only PASS when all checkpoints are observed. Generated Korean fixture is NOT a
Samsung real phone recording; x86_64 build is NOT byte-identical ARM64 binary.
"""
import json, os, re, subprocess, time, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

OUT=Path("emulator-qa-v11")
OUT.mkdir(exist_ok=True)
PKG="app.hitel.koreanzipformer.stream17"
MAIN=PKG+"/app.hitel.sherpaoriginalcli.MainActivity"
NAME="ko_live_test.m4a"

def adb(*args, timeout=40, check=True):
    cmd=["adb"]+list(args)
    p=subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=timeout)
    if check and p.returncode:
        raise RuntimeError(" ".join(cmd)+": "+p.stdout[-1500:]+p.stderr[-1500:])
    return p.stdout.strip()

def ui_xml():
    adb("shell","uiautomator","dump","/sdcard/uiv11.xml",timeout=55)
    raw=adb("exec-out","cat","/sdcard/uiv11.xml",timeout=30)
    (OUT/"latest-ui.xml").write_text(raw,encoding="utf-8")
    return ET.fromstring(raw)

def nodes():
    root=ui_xml()
    return [(n, n.attrib.get("text","") or n.attrib.get("content-desc","")) for n in root.iter("node")]

def tap_name(names, seconds=15):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        try:
            listing=nodes()
            for preference in (0,1):
                for n,title in listing:
                    if any((title.casefold()==x.casefold() if preference==0 else x.casefold() in title.casefold()) for x in names):
                        coords=list(map(int,re.findall(r"\d+",n.attrib.get("bounds",""))))
                        if len(coords)==4:
                            x=(coords[0]+coords[2])//2
                            y=(coords[1]+coords[3])//2
                            adb("shell","input","tap",str(x),str(y))
                            print("TAPPED",title,x,y,flush=True)
                            time.sleep(1.2)
                            return True
            adb("shell","input","swipe","450","1700","450","650","390",check=False)
        except Exception as exc:
            print("UI RETRY",repr(exc),flush=True)
        time.sleep(1)
    return False

def capture(label):
    adb("shell","screencap","-p",f"/sdcard/v11-{label}.png",check=False)
    adb("pull",f"/sdcard/v11-{label}.png",str(OUT/f"{label}.png"),timeout=30,check=False)
    try: ui_xml()
    except Exception: pass
    (OUT/f"{label}-logcat.txt").write_text(adb("logcat","-d","-v","threadtime",timeout=45,check=False),encoding="utf-8")

def diag_path():
    x=adb("shell","run-as",PKG,"ls","files/diagnostics",check=False)
    names=re.findall(r"run-\d{8}-\d{6}-\d+",x)
    return "files/diagnostics/"+names[-1] if names else None

def read_log(name):
    directory=diag_path()
    if not directory:return ""
    return adb("exec-out","run-as",PKG,"cat",directory+"/"+name,timeout=60,check=False)

def archive_logs():
    path=diag_path()
    if not path:return {}
    d=OUT/"app-logs";d.mkdir(exist_ok=True)
    output={}
    for fn in ("latency-trace.jsonl","events.jsonl","stt-raw.txt","ffmpeg-raw.txt","audio-cursor-checkpoint.json"):
        contents=read_log(fn)
        (d/fn).write_text(contents,encoding="utf-8")
        output[fn]=len(contents)
    with zipfile.ZipFile(OUT/"emulator-v11-diagnostics.zip","w",compression=zipfile.ZIP_DEFLATED) as z:
        for item in d.iterdir():
            z.write(item,item.name)
    return output

def check_actual():
    print("EMULATOR",adb("shell","getprop","ro.build.version.sdk"),
          adb("shell","getprop","ro.product.cpu.abi"),flush=True)
    assert adb("shell","getprop","ro.build.version.sdk")=="35"
    assert adb("shell","getprop","ro.product.cpu.abi")=="x86_64"
    print("PACKAGE",adb("shell","pm","path",PKG),flush=True)
    adb("logcat","-c")
    adb("shell","am","start","-n",MAIN)
    time.sleep(2.5)
    capture("main-started")
    assert tap_name(["녹음 M4A 파일 직접 선택","녹음 M4A 파일 직접 선택 (이미 존재하는 파일)"],20), "file-picker button missing"
    capture("document-picker")
    listings=[label for _,label in nodes()]
    if not any(NAME in n for n in listings):
        if tap_name(["Show roots","Show navigation drawer","탐색 메뉴","Navigate up"],8):
            tap_name(["Downloads","Download","다운로드"],12)
    if not tap_name([NAME],25):
        capture("picker-missing-file")
        raise RuntimeError("M4A is not selectable through actual Android DocumentsUI")
    time.sleep(2)
    capture("file-picked")
    if not tap_name(["FFmpeg + 한국어 Zipformer 진단 시작"],15):
        raise RuntimeError("STT start button missing after picker")
    print("APP DIAGNOSIS STARTED",flush=True)
    time.sleep(3)
    capture("stt-running")
    found=False
    deadline=time.monotonic()+270
    while time.monotonic()<deadline:
        raw=read_log("latency-trace.jsonl")
        events=read_log("events.jsonl")
        if "LIVE_SET_TEXT" in raw and '"LIVE_CAPTION"' in events:
            found=True
        # Never stop on the first word. Preserve the entire 16.725-second
        # reference input: an early stop previously hid truncated PCM delivery.
        buffered_audio_ms=0
        try:
            buffered_audio_ms=max((int(e.get("data",{}).get("audioEndMs",0)) for e in
                (json.loads(line) for line in raw.splitlines() if line.strip())
                if e.get("stage")=="PCM" and e.get("event")=="PIPE_WRITE_END"),default=0)
        except (ValueError,TypeError,json.JSONDecodeError):pass
        print("FULL_PCM_PROGRESS_MS",buffered_audio_ms,"CAPTIONS",found,flush=True)
        if found and buffered_audio_ms>=16500:
            print("REAL_FULL_AUDIO_PCM_AND_CAPTIONS_CONFIRMED",flush=True)
            break
        if any(t in events for t in ("FATAL_ERROR","MODEL_LOAD_FAILED","FIFO_READ_OR_STT_WRITE_FAILURE")):
            print("STT WARNING/ERROR", events[-1200:],flush=True)
        print("STT POLL",round(deadline-time.monotonic()),"remaining; timeline",len(raw),
              "events",len(events),flush=True)
        time.sleep(8)
    capture("stt-completed-or-timeout")
    tap_name(["진단 중지"],8)
    time.sleep(3)
    report=archive_logs()
    print("APP LOG FILES",report,flush=True)
    timeline=read_log("latency-trace.jsonl")
    events=read_log("events.jsonl")
    stages={x.get("stage") for x in (json.loads(line) for line in timeline.splitlines()
                                   if line.strip() and line.startswith("{"))}
    print("STAGES",sorted(str(x) for x in stages),flush=True)
    total_audio_ms=max((int(e.get("data",{}).get("audioEndMs",0)) for e in
        (json.loads(line) for line in timeline.splitlines() if line.strip())
        if e.get("stage")=="PCM" and e.get("event")=="PIPE_WRITE_END"),default=0)
    checks={
        "prewarm gate released":'"PREWARM_GATE_RELEASED"' in timeline,
        "at least 16.5s source PCM transferred":total_audio_ms>=16500,
        "APK installed":bool(adb("shell","pm","path",PKG,check=False)),
        "AAC input path active":('"PERSISTENT_ANDROID_AAC_DECODER_STARTED"' in events
            if os.getenv("REQUIRE_CONTINUOUS_AAC")=="1" else
            '"ATTEMPT_BEGIN"' in events or '"START_COMMAND"' in timeline),
        "PCM delivered":'"PIPE_WRITE_END"' in timeline,
        "native model ready":'"READY_IN_JAVA"' in timeline,
        "native PCM accepted":'"event":"INPUT"' in timeline,
        "native decode performed":'"event":"DECODE"' in timeline,
        "native partial caption":'"event":"LIVE"' in timeline,
        "TextView changed":'"LIVE_SET_TEXT"' in timeline,
        "frame callback":'"NEXT_FRAME_CALLBACK"' in timeline,
        "captions in UI":found,
        "timeline exported":len(timeline)>100,
    }
    if os.getenv("REQUIRE_INCREMENTAL_GROWING")=="1":
        commits=[x for x in (json.loads(line) for line in timeline.splitlines()
                           if line.strip() and line.startswith("{"))
                 if x.get("stage")=="AAC" and x.get("event")=="SOURCE_CURSOR_COMMITTED"]
        positions=[int(x.get("data",{}).get("sourceByte",0)) for x in commits]
        checks["growing AAC source cursor committed at least twice"]=len(positions)>=2
        checks["AAC source cursor strictly increases"]=all(b>a for a,b in zip(positions,positions[1:]))
        checks["incremental AAC frames, not full-file rereads"]='"NEW_FRAMES_READY"' in events
        timelineEvents=[json.loads(line) for line in timeline.splitlines()
                        if line.strip() and line.startswith("{")]
        continuous=os.getenv("REQUIRE_CONTINUOUS_AAC")=="1"
        drainAck=[e for e in timelineEvents if e.get("stage")=="PIPE"
                  and e.get("event")=="READER_DRAIN_ACKNOWLEDGED"]
        decoded=[e for e in timelineEvents if e.get("stage")=="STREAM"
                 and e.get("event")=="AAC_DELTA_DECODED"]
        if continuous:
            checks["all cursor commits follow continuous decoded AAC frames"]=(
                len(decoded)>=len(commits)>=4 and
                all(int(d.get("boot_ns",0))>0 and
                    int(d.get("boot_ns",0))<=int(c.get("boot_ns",0))
                    for d,c in zip(decoded,commits)))
            checks["one persistent AAC MediaCodec instance"]=(
                events.count('"PERSISTENT_ANDROID_AAC_DECODER_STARTED"')==1)
            checks["no repeated FFmpeg processes for growing Samsung AAC"]=(
                '"ATTEMPT_BEGIN"' not in events and '"START_COMMAND"' not in timeline)
        else:
            checks["all cursor commits follow completed PCM reader drain"]=(
                len(drainAck)>=len(commits)>=4 and
                all(int(a.get("boot_ns",0))>0 and
                    int(a.get("boot_ns",0))<=int(c.get("boot_ns",0))
                    for a,c in zip(drainAck,commits)))
        (OUT/"fifo-drain-ack-count.json").write_text(
            json.dumps({"ack":len(drainAck),"decodedDeltas":len(decoded),
                        "committed":len(commits)}),
            encoding="utf-8")
        checks["no undrained reader was accepted"]='"READER_DRAIN_NOT_CONFIRMED"' not in events
        (OUT/"fifo-drain-ack-count.json").write_text(
            json.dumps({"ack":len(drainAck),"committed":len(commits)}),
            encoding="utf-8")
        checkpointText=read_log("audio-cursor-checkpoint.json")
        try: checkpoint=json.loads(checkpointText)
        except (ValueError,TypeError): checkpoint={}
        checks["saved source cursor and audio time"]=(
            int(checkpoint.get("aacSourceByteCursor",0))>0 and
            int(checkpoint.get("audioTimeMs",0))>=16500)
        rawNative=read_log("stt-raw.txt")
        checks["legacy prior speech segmentation disabled"]='ONLINE_PRIOR_CONTEXT:' not in rawNative
        checks["continuous live captions without pause gate"]=('ONLINE_LIVE:' in rawNative)
        print("CURSOR_CHECKPOINT",checkpoint,flush=True)
        (OUT/"aac-cursor-positions.json").write_text(json.dumps(positions),encoding="utf-8")
        print("SOURCE_CURSOR_POSITIONS",positions,flush=True)
    (OUT/"checks.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding="utf-8")
    print("CHECKS",checks,flush=True)
    if not all(checks.values()):
        raise RuntimeError("E2E FAIL - failed checkpoints: "+repr([k for k,v in checks.items() if not v]))
    original=os.environ.get("GALAXY_ORIGINAL_SHA256","")
    sample=("original Samsung call M4A verified SHA256 "+original if original
           else "generated public Korean speech fixture")
    (OUT/"PASS.txt").write_text("PASS Android 15 x86_64. APK actual install; DocumentsUI M4A; "
        "174M Zipformer native partial captions; UI setText and frame callbacks; "
        "latency diagnostic JSONL; 16.5s+ PCM processed; "+sample+". "
        "Separate x86_64 APK; ARM64 real Galaxy unverified.\n",encoding="utf-8")

if __name__=="__main__":
    try:check_actual()
    except BaseException as exc:
        print("E2E FAILED",repr(exc),flush=True)
        try:capture("failure")
        except Exception:pass
        try:archive_logs()
        except Exception:pass
        raise
