#!/usr/bin/env python3
"""Strict emulator proof: original source-observed 10 exam rows -> actual Android
WebView DOM -> production ReadingOriginalPageCapture JS -> Java bridge -> SQLite.
No actual origin request or counterfeit claim of live nationwide collection.
"""
import base64,csv,hashlib,html,io,json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path("work/r17-webview-evidence")
OUT.mkdir(parents=True,exist_ok=True)
PKG="com.eduzone.eduzoneviewer"
ENTRY=PKG+"/com.hitel.zocbodiag.NativePdfEntryActivity"
EXTRA_COLLECT="com.hitel.zocbodiag.COLLECT_METADATA"
EXTRA_HTML="com.hitel.zocbodiag.QA_ORIGINAL_HTML_BASE64"
ROWS=json.loads(Path(".github/qa/fixtures/zocbo_user_observed_previousExam_20261123_10ids.json").read_text("utf-8"))
EXPECTED_IDS=sorted(x["expapr_no"] for x in ROWS)
assert len(ROWS)==10 and len(set(EXPECTED_IDS))==10
assert hashlib.sha256(",".join(EXPECTED_IDS).encode()).hexdigest()=="105e63ffe98c84f8c3dc61ee560e16ddaed266115afefec2d96d3b8c91cf7ab5"

def adb(*args,timeout=90):
    r=subprocess.run(["adb",*map(str,args)],capture_output=True,text=True,timeout=timeout)
    if r.returncode:raise RuntimeError("ADB "+str(args[:4])+" err="+str(r.returncode)+" "+r.stderr[:400])
    return r.stdout

def snap(label):
    adb("shell","uiautomator","dump","/sdcard/r17.xml",timeout=50)
    x=adb("shell","cat","/sdcard/r17.xml")
    (OUT/(label+".xml")).write_text(x,"utf-8")
    with (OUT/(label+".png")).open("wb") as f:
        r=subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,stderr=subprocess.PIPE,timeout=50)
        assert r.returncode==0
    print("R17_UI",label,re.findall(r'text="([^"]+)"',x)[:27],flush=True)
    return x

def tap(xml,name):
    for el in ET.fromstring(xml).iter():
        if name not in (el.attrib.get("text","")+" "+el.attrib.get("content-desc","")):continue
        if el.attrib.get("clickable")!="true":continue
        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",el.attrib.get("bounds",""))
        if not m:continue
        x1,y1,x2,y2=map(int,m.groups())
        if x2<=x1 or y2<=y1:continue
        adb("shell","input","tap",(x1+x2)//2,(y1+y2)//2)
        print("R17_TAP",name,flush=True);return True
    return False

# Exact selector class/id/attribute layout extracted from the prior actual
# user's previousExam.asp HTML. No arbitrary exam numbers or personal tokens.
parts=['<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Original page fragment</title>',
'<script>var SiteID="H";var Grade="1";var Subj_Code="HI";',
'var ExPapr_TestYear="2022";var ExPapr_MidEndTerm="2E";',
'var scl_id="9113|9114|9117"; var filter_gugun="0001";',
'var data_v=""; data_v = data_v + "&Rg_CitiesProvinces=" + "서울";',
'data_v = data_v + "&Rg_District=" + "광진구";</script></head>',
'<body><div class="download__list"><div class="download__item" id="div_add_school">']
for row in ROWS:
    esc=lambda x:html.escape(x,quote=True)
    title=row["viewer_title"]; school=row["scl_short_name"]; subject=row["Subj_Name"]
    term=title[len(school)+1:len(title)-len(subject)-1]
    parts.append('<div class="download"><div class="download__badge"><span class="badge">'+
      row["ExPapr_TestYear"]+'</span><span class="area">서울 강남구</span></div>'+
      '<div class="grouping__box"><strong class="text__school">'+esc(school)+
      '</strong><span class="text__subject">'+esc(term)+'</span></div>'+
      '<div class="grouping__box"><span class="class__subject">'+esc(subject)+
      '</span></div><div class="button__box"><button class="button__item" type="button" id="li_freereading" data-no="'+
      row["expapr_no"]+'" data-kindList="A" data-coretype="E">기출</button></div></div>')
parts.append('</div></div></body></html>')
html_content="".join(parts)
encoded=base64.b64encode(html_content.encode("utf-8")).decode()
print("R17_ORIGINAL_HTML_FRAGMENT_BYTES",len(html_content.encode()),"ROWS",len(ROWS),flush=True)

apk=Path("work/r17.apk")
assert apk.exists() and apk.stat().st_size>30000000
adb("install","-r",str(apk),timeout=180)
adb("logcat","-c")
adb("shell","am","start","-n",ENTRY,"--ez",EXTRA_COLLECT,"true","--es",EXTRA_HTML,encoded)
time.sleep(10)
logs=adb("logcat","-d","-v","time",timeout=100)
(OUT/"first_launch_logcat.txt").write_text(logs,encoding="utf-8")
proof=re.findall(r'COLLECTOR_QA_CAPTURED_WEBVIEW_SQLITE_COMMIT[^\n]*',logs)
print("R17_REAL_WEBVIEW_CAPTURE_LOG",proof[-1] if proof else "MISSING",flush=True)
assert proof and "page_rows=10 committed=10 db_count=10" in proof[-1] and "origin=PRIOR_USER_HTML" in proof[-1],"Production webview DOM -> Java bridge -> SQLite not verified"
x=snap("01_real_webview_captured_10")
assert "저장 DB: 10건" in x or "DB: 10건" in x
print("R17_WEBVIEW_ORIGINAL_DOM_TO_ACTUAL_ANDROID_SQLITE_PASS",flush=True)

adb("shell","am","force-stop",PKG)
time.sleep(2)
adb("shell","am","start","-n",ENTRY,"--ez",EXTRA_COLLECT,"true")
time.sleep(7)
x=snap("02_force_stopped_and_reopened")
assert "저장 DB: 10건" in x or "DB: 10건" in x,"lost captured original records after restart"
assert tap(x,"CSV 파일 내보내기"),"CSV button not available"
time.sleep(4)
p=snap("03_csv_save_picker")
assert tap(p,"SAVE") or tap(p,"저장"),"CSV picker did not expose Save"
time.sleep(6)
x=snap("04_csv_save_success")
assert "CSV 저장 완료: 10건" in x,"CSV export did not report 10"
names=adb("shell","ls","-1","/sdcard/Download").splitlines()
matches=[z.strip() for z in names if z.startswith("zocbo_exam_metadata_") and z.endswith(".csv")]
assert len(matches)==1,repr(matches)
data=adb("shell","cat","/sdcard/Download/"+matches[0])
(OUT/"exported_metadata_from_actual_webview.csv").write_text(data,"utf-8")
rows=list(csv.DictReader(io.StringIO(data.lstrip("\ufeff"))))
assert len(rows)==10 and sorted(x["exam_no"] for x in rows)==EXPECTED_IDS,"actual CSV IDs mismatch"
assert {x["source_scope"] for x in rows}=={"QA_USER_CAPTURED_HTML_WEBVIEW"},"incorrect live provenance"
for item in rows:
    expected=next(x for x in ROWS if x["expapr_no"]==item["exam_no"])
    assert item["school"]==expected["scl_short_name"] and item["title"]==expected["viewer_title"],item
print("R17_REAL_WEBVIEW_JS_TO_SQLITE_RESTART_AND_EXPORTED_CSV_10_PASS live_origin=False",flush=True)
