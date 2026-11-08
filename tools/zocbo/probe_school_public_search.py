#!/usr/bin/env python3
"""Anonymous public metadata probe of official school region / school lists / exam search.
No login, files, paid content, or mutations.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path("public/zocbo-original-data")
OUT.mkdir(exist_ok=True)
BASE="https://m.zocbo.com"
ORIGIN=BASE+"/M/expected.asp"
REPORT={}
def post(ctx,slug,path,form):
 try:
  r=ctx.request.post(BASE+path,form=form,headers={
    "Referer":ORIGIN,"Origin":BASE,"X-Requested-With":"XMLHttpRequest",
    "Accept":"application/json,text/javascript,*/*;q=0.01"},timeout=18000)
  raw=r.text()
  try:data=json.loads(raw)
  except Exception:
   REPORT[slug]={"http":r.status,"error":"NON_JSON","preview":raw[:180]}
   return None
  REPORT[slug]={"http":r.status,"keys":list(data)[:30] if isinstance(data,dict) else [],
   "count":len(data.get("list",[])) if isinstance(data,dict) and isinstance(data.get("list"),list) else data.get("RecordCount") if isinstance(data,dict) else None}
  return data
 except Exception as e:
  REPORT[slug]={"error":str(e)[:230]}
  return None
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,locale="ko-KR")
 page=ctx.new_page()
 page.goto(ORIGIN,wait_until="domcontentloaded",timeout=30000)
 page.wait_for_timeout(1500)
 reg=post(ctx,"districts","/_api/community.api.asp",{"cmd":"GET_REGION_LIST","si":"서울"})
 if isinstance(reg,dict):
  rows=reg.get("list",[]) if isinstance(reg.get("list"),list) else []
  REPORT["districts"]["names"]=[x.get("rg_District") for x in rows if isinstance(x,dict)][:40]
 schools=post(ctx,"schools","/_api/community.api.asp",{"cmd":"GET_SCHOOL_LIST","site_id":"M","si":"서울","region":"강남구"})
 school_id=''
 if isinstance(schools,dict):
  rows=schools.get("list",[]) if isinstance(schools.get("list"),list) else []
  found=[{"school":x.get("Scl_Name"),"id":x.get("Scl_ID")} for x in rows if isinstance(x,dict) and ("숙명" in str(x.get("Scl_Name")) or "숙명" in str(x.get("Name")))]
  REPORT["schools"]["matches"]=found[:10]
  school_id=str(found[0]["id"]) if found else ''
 if school_id:
  common={"SiteID":"M","Rg_CitiesProvinces":"서울","Rg_District":"강남구","Scl_ID":school_id,
    "Exfl_Group":"2","ExPapr_CoreType":"","Grade":"2","Subj_Code":"MT","Subj_Name":"수학","tx_code":""}
  for k,part in (("school_initial",""),("school_scope","last_Search_Y")):
   d=post(ctx,k,"/ZocboMid/ZocboExam/Exam_Default.asp",{**common,"search_Part_ID_Set":part})
   if isinstance(d,dict):
    REPORT[k]["recordCount"]=d.get("RecordCount")
    REPORT[k]["partId"]=str(d.get("search_Part_ID_Set",""))[:90]
    REPORT[k]["firstTitle"]=str(d.get("expapr_title",""))[:100]
 ctx.close();browser.close()
(OUT/"school_public_probe.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding="utf8")
print("SCHOOL_PUBLIC_PROBE",json.dumps(REPORT,ensure_ascii=False)[:4500],flush=True)
