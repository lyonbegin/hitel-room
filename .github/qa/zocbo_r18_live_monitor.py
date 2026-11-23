#!/usr/bin/env python3
"""Live Android emulator monitor. It NEVER counts replay fixture records as live.
Writes a source-grounded status.json to GitHub Release every 5 minutes and at exit.
Stops on verified source block or missing heartbeat. No auth/rate-limit bypass.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import time

OUT=Path("work/zocbo-nine-region-live")
OUT.mkdir(parents=True,exist_ok=True)
APP="com.eduzone.eduzoneviewer"
ENTRY=APP+"/com.hitel.zocbodiag.NativePdfEntryActivity"
COLLECT="com.hitel.zocbodiag.COLLECT_METADATA"
AUTO="com.hitel.zocbodiag.AUTO_NINE_REGION"
TAG="zocbo-nine-region-monitor-20261124"
RUN_ID=os.environ.get("GITHUB_RUN_ID","unknown")
REPO=os.environ.get("GITHUB_REPOSITORY","lyonbegin/hitel-room")
START=time.time()
last_log=""
latest={}
last_progress_value=None
last_progress_at=None
events=[]
state="STARTING"
problem=""
def utc(ts=None):
    return dt.datetime.fromtimestamp(ts or time.time(),tz=dt.timezone.utc).isoformat()
def cmd(args,timeout=80,allow_fail=False):
    r=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if not allow_fail and r.returncode:
        raise RuntimeError(str(args[:5])+" failed "+str(r.returncode)+": "+r.stderr[-500:])
    return r.stdout
def adb(*args,timeout=80):
    return cmd(["adb",*map(str,args)],timeout=timeout)
def get_events():
    raw=adb("logcat","-d","-v","time","-s","ZocboNine:I","*:S",timeout=90)
    (OUT/"zocbo_nine_logcat.txt").write_text(raw,"utf-8")
    return [line for line in raw.splitlines() if "ZocboNine" in line and "stage=" in line]
def parse(line):
    info={}
    for key in ("stage","site","region_position","selected","area_scopes","live_exam_unique",
                "checkpoint","pages"):
        m=re.search(r"\b"+key+r"=([^ ]+)",line)
        if m: info[key]=m.group(1)
    # Never present a missing counter as a positive count.
    for key in ("area_scopes","live_exam_unique","pages"):
        if key in info:
            try: info[key]=int(info[key])
            except ValueError: info.pop(key,None)
    info["raw_tail"]=line[-260:]
    return info
def publish():
    global latest
    rows=get_events()
    newest=parse(rows[-1]) if rows else {}
    unique=newest.get("live_exam_unique")
    region=newest.get("selected")
    stage=newest.get("stage")
    last_source_row_at=None
    for line in reversed(rows):
        if "stage=PAGE_SAVED" in line or "stage=AREA_SAVED" in line:
            last_source_row_at=line.split(" ",1)[0]
            break
    status={
        "updated_at_utc":utc(),
        "run_id":RUN_ID,
        "run_url":f"https://github.com/{REPO}/actions/runs/{RUN_ID}",
        "stage":stage or state,
        "collector_state":state,
        "current_region":region if region and region!="selected=" else None,
        "region_position":newest.get("region_position"),
        "school_level":newest.get("site"),
        "saved_original_region_scopes":newest.get("area_scopes"),
        "live_server_unique_exams":unique,
        "pages_processed":newest.get("pages"),
        "last_source_page_log_date":last_source_row_at,
        "last_progress_utc":utc(last_progress_at) if last_progress_at else None,
        "heartbeats_observed":sum("stage=HEARTBEAT" in x for x in rows),
        "events_observed":len(rows),
        "last_error":problem or None,
        "evidence_type":"real_Android_emulator_original_server_attempt",
        "offline_replay_counted":False,
        "auth_bypass":False,
        "data_verified":bool(unique is not None and unique>0),
    }
    (OUT/"status.json").write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n","utf-8")
    latest=status
    print("ZOCBO_NINE_POLL "+json.dumps(status,ensure_ascii=False),flush=True)
    cmd(["gh","release","upload",TAG,str(OUT/"status.json"),"--clobber","-R",REPO],timeout=75)
    return status,rows
def launch():
    adb("install","-r","work/r18-live.apk",timeout=180)
    adb("logcat","-c")
    started=adb("shell","am","start","-n",ENTRY,"--ez",COLLECT,"true","--ez",AUTO,"true")
    print("ZOCBO_NINE_ACTIVITY_START",started[:280],flush=True)
def stage_is_blocked(rows):
    for e in reversed(rows):
        if "stage=BLOCKED" in e or "stage=PAUSED" in e:
            return e[-220:]
        if "stage=PAGE_SAVED" in e or "stage=CLICK_SOURCE_REGION" in e or "stage=AREA_SAVED" in e:
            return ""
    return ""
def store_checkpoint():
    """Only preserve real app-private DB if emulator root and a real DB exist."""
    try:
        adb("shell","am","force-stop",APP)
        root=cmd(["adb","root"],timeout=50,allow_fail=True)
        print("ZOCBO_NINE_ADB_ROOT",root.strip(),flush=True)
        time.sleep(3)
        adb("wait-for-device",timeout=70)
        db=f"/data/user/0/{APP}/databases/zocbo_exam_metadata_v1.db"
        if cmd(["adb","shell","ls",db],allow_fail=True).strip()!=db:
            print("ZOCBO_NINE_CHECKPOINT_ABSENT",flush=True);return False
        out=OUT/"checkpoint.db"
        cmd(["adb","pull",db,str(out)],timeout=80)
        if out.stat().st_size<4096:raise RuntimeError("SQLite db is unexpectedly small")
        import sqlite3
        con=sqlite3.connect(f"file:{out}?mode=ro",uri=True)
        try:
            check=con.execute("PRAGMA integrity_check").fetchone()[0]
            n=con.execute("select count(*) from exams where source_scope like 'LIVE_%' or source_scope like 'ORIGINAL_AREA:%'").fetchone()[0]
            print("ZOCBO_NINE_DB_CHECK integrity="+str(check)+" live_rows="+str(n),flush=True)
            if check!="ok":raise RuntimeError("SQLite integrity check failed")
            if n<=0: return False
        finally:con.close()
        cmd(["gh","release","upload",TAG,str(out),"--clobber","-R",REPO],timeout=100)
        print("ZOCBO_NINE_DB_CHECKPOINT_UPLOADED rows="+str(n),flush=True)
        return True
    except Exception as exc:
        print("ZOCBO_NINE_DB_CHECKPOINT_FAILED "+str(exc)[:300],flush=True)
        return False
try:
    state="EMULATOR_START"
    launch()
    state="RUNNING"
    # Internal sampling is every minute; persistent remote status every five.
    for minute in range(0,21):
        if minute:time.sleep(60)
        lines=get_events()
        if lines:
            row=parse(lines[-1])
            value=(row.get("stage"),row.get("region_position"),row.get("pages"),row.get("live_exam_unique"))
            if value!=last_progress_value and row.get("stage")!="HEARTBEAT":
                last_progress_at=time.time()
                last_progress_value=value
            elif row.get("stage")=="HEARTBEAT" and last_progress_at is None:
                last_progress_at=time.time()
            blocked=stage_is_blocked(lines)
            if blocked:
                problem="SOURCE_OR_AUTH_BLOCKED: "+blocked
                state="BLOCKED"
        elif minute>=2:
            problem="NO_SOURCE_LOGCAT after 2 minutes; cannot assert origin data was fetched"
            state="BLOCKED"
        if minute%5==0 or state=="BLOCKED":
            publish()
        if state=="BLOCKED": break
    if state=="RUNNING":
        state="TIME_WINDOW_ENDED"
    preserved=store_checkpoint()
    if not preserved and latest.get("live_server_unique_exams",0):
        problem="Live count exists but durable DB checkpoint could not be preserved"
        state="BLOCKED"
    publish()
    if state=="BLOCKED":
        raise SystemExit("ZOCBO_NINE_BLOCKED "+problem)
    if not latest.get("data_verified"):
        raise SystemExit("ZOCBO_NINE_NO_LIVE_DATA_VERIFIED")
    print("ZOCBO_NINE_BATCH_VERIFIED saved_live="+str(latest["live_server_unique_exams"]),flush=True)
except BaseException as exc:
    if not problem:problem=type(exc).__name__+": "+str(exc)[:350]
    try:
        state="BLOCKED" if state not in ("TIME_WINDOW_ENDED","BLOCKED") else state
        publish()
    except Exception as p:
        print("ZOCBO_NINE_PUBLISH_FAILURE "+str(p)[:400],flush=True)
    raise
