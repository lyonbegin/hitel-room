#!/usr/bin/env python3
"""Public mobile original -> HITEL coverage and function gap audit.
Pure browser inspection of anonymous pages; NO auth submission, sample downloads,
user session handling, token reads, paywalled fetches, or authenticated navigation.
"""
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse, urljoin, parse_qs
from playwright.async_api import async_playwright

BASE="https://m.zocbo.com"
HITEL="https://hitel-zocbo-native-hierarchy-production.up.railway.app"
OUT=Path("zocbo-full-mobile-gaps")
OUT.mkdir(exist_ok=True)
OFFICIAL={
 "mobile_home":BASE+"/",
 "app_home":BASE+"/app/main_v2.asp",
 "login":BASE+"/Member/login.asp",
 "middle_problem":BASE+"/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT",
 "high_problem":BASE+"/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT",
 "middle_concept":BASE+"/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT",
 "high_concept":BASE+"/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=MT",
 "middle_expected":BASE+"/M/expected.asp",
 "high_expected":BASE+"/H/expected.asp",
 "free_reading":BASE+"/Freetrial/FreeReading.asp",
 "free_reading_web":BASE+"/exam/school/previousexam.asp?search_webview=Y",
 "finals_2026":BASE+"/event/pre-test2026d/",
 "learning_diagnostic":BASE+"/Freetrial/learningtest.asp",
 "revision":BASE+"/guide/revision/default_M.asp",
 "member_benefits":BASE+"/Freetrial/main_s.asp",
}
HITEL_ROUTES={
 "bankHome":"app_home",
 "bankSearch":"high_problem",
 "bankResults":"high_problem",
 "bankPaper":"high_problem",
 "bankOriginal":"app_home",
 "bankLogin":"login",
 "bankSchool":"middle_expected",
 "bankFree":"free_reading",
 "bankDownload":"finals_2026",
 "bankSaved":None,
 "bankDiagnostic":"learning_diagnostic",
 "bankCategory":None,
}
# UI presence classification is tested independently of HTTP 200.
def is_origin(url):
 host=urlparse(url).hostname or ""
 return host=="zocbo.com" or host.endswith(".zocbo.com")
def snap(d,filename):
 (OUT/filename).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf8")

JS_PUBLIC_STATE="""() => {
 const txt=(document.body?.innerText||'').trim();
 const anchors=[...document.querySelectorAll('a[href]')].filter(a=>a.href&&/^https?:/.test(a.href)).slice(0,400).map(a=>({text:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,70),href:a.href}));
 const controls=[...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')].slice(0,300).map(e=>({text:(e.innerText||e.getAttribute('value')||e.getAttribute('aria-label')||'').trim().slice(0,70),act:e.getAttribute('data-act')||'',onclick:(e.getAttribute('onclick')||'').slice(0,100)}));
 const main=document.querySelector('#examMain');
 const login=document.querySelector('input[type="password"]');
 return {title:document.title,bodyTextChars:txt.length,bodyPreview:txt.slice(0,320),examMainPresent:!!main,examMainChildren:main?.children.length||0,examMainTextChars:(main?.innerText||'').length,
  links:anchors.filter(a=>/^https?:\/\/(?:[^/]+\.)?zocbo\.com/.test(a.href)).slice(0,140),
  controls:controls.slice(0,80),anchorsTotal:anchors.length,controlsTotal:document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').length,
  passwordFieldPresent:!!login,loginFormAction:login?.form?.action||null,
  publicDownloadCount:document.querySelectorAll('[data-act="sampleDown"]').length,
  schoolInputs:[...document.querySelectorAll('input')].filter(e=>/school|sch|학교/i.test((e.name||'')+' '+(e.placeholder||'')+' '+(e.id||''))).map(e=>({id:e.id,name:e.name,placeholder:e.placeholder})).slice(0,12),
  bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth
 };
}"""
JS_HITEL_STATE="""() => {
 const el=document.querySelector('#phone');
 const t=(el?.innerText||'').trim();
 const a=[...(el?.querySelectorAll('a[href]')||[])].map(x=>({text:(x.innerText||'').trim().slice(0,90),href:x.href,target:x.target}));
 const controls=[...(el?.querySelectorAll('button,[role="button"]')||[])].map(e=>({text:(e.innerText||'').trim().slice(0,90),go:e.dataset.go||null,action:e.dataset.action||null}));
 return {title:document.querySelector('#stageTitle')?.textContent||'',screen:new URL(location.href).searchParams.get('screen'),
  bodyTextChars:t.length,bodyPreview:t.slice(0,450),anchors:a,buttons:controls.slice(0,100),buttonsTotal:controls.length,
  officialLinks:a.filter(v=>/^https:\/\/(?:[^/]+\.)?zocbo\.com/.test(v.href)),nativeHierarchyRoots:el?.querySelectorAll('.zb-native-root').length||0,
  nativeEpisodes:el?.querySelectorAll('.zb-native-episode').length||0,
  copiedOfficialEventButtons:el?.querySelectorAll('[data-action="zbOriginalDownload"]').length||0,
  copiedEventPrompt:el?.querySelectorAll('.zocbo-handoff').length||0,
  officialExternalOnly:el?.querySelectorAll('.zocbo-native-handoff').length||0,
  loginInputs:el?.querySelectorAll('input[type="password"]').length||0,
  iframes:el?.querySelectorAll('iframe').length||0,
  textInputs:el?.querySelectorAll('input:not([type="hidden"])').length||0,
  width:document.documentElement.scrollWidth,viewport:innerWidth
 };
}"""
async def load_original(browser,key,url,sem):
 async with sem:
  ctx=await browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR",user_agent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36")
  page=await ctx.new_page()
  errors=[]
  responses=[]
  page.on("pageerror",lambda e: errors.append(str(e)[:230]))
  def response(r):
   parsed=urlparse(r.url)
   if not is_origin(r.url):return
   if "/ajax/" in parsed.path.lower() or "/_api/" in parsed.path.lower():
    if len(responses)<35:responses.append({"path":parsed.path,"status":r.status,"method":r.request.method})
  page.on("response",response)
  result={"source":url}
  try:
   response=await page.goto(url,wait_until="domcontentloaded",timeout=32000)
   result["httpStatus"]=response.status if response else None
   await page.wait_for_timeout(4000 if ("examListWeb" in url or "previousexam" in url) else 2800)
   result["resolved"]=page.url
   result["dom"]=await page.evaluate(JS_PUBLIC_STATE)
   result["ajax"]=responses
   result["pageErrors"]=errors[:10]
   result["redirectedToLogin"]="login" in (urlparse(page.url).path.lower())
   result["sawProblemContent"]=result["dom"].get("examMainTextChars",0)>80
   if key in ("app_home","middle_problem","high_problem","middle_concept","middle_expected","free_reading","free_reading_web","finals_2026","learning_diagnostic","login"):
    try:await page.screenshot(path=str(OUT/f"official-{key}.png"),full_page=False,timeout=7500)
    except Exception as e:result["screenshotError"]=str(e)[:100]
  except Exception as e:result["failure"]=str(e)[:450]
  finally:await ctx.close()
  print("ORIGINAL",key,"HTTP",result.get("httpStatus"),"text",result.get("dom",{}).get("bodyTextChars"),"exam",result.get("dom",{}).get("examMainTextChars"),"err",result.get("failure"),flush=True)
  return key,result

async def load_hitel(browser,key,target,sem):
 async with sem:
  ctx=await browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR")
  page=await ctx.new_page()
  errs=[]
  page.on("pageerror",lambda e:errs.append(str(e)[:300]))
  url=HITEL+"/?screen="+key
  if key=="bankPaper":url+="&paper=H1-MT"
  result={"source":url,"comparesWith":target}
  try:
   response=await page.goto(url,wait_until="domcontentloaded",timeout=30000)
   result["httpStatus"]=response.status if response else None
   if key in ("bankSearch","bankResults"):
    try:await page.wait_for_selector(".zb-native-summary",timeout=24000)
    except Exception as e:result["liveLoadError"]=str(e)[:190]
   else:await page.wait_for_timeout(450)
   result["dom"]=await page.evaluate(JS_HITEL_STATE)
   result["pageErrors"]=errs[:10]
   if key in ("bankHome","bankSearch","bankPaper","bankLogin","bankSchool","bankFree","bankDownload","bankDiagnostic","bankCategory"):
    try:await page.screenshot(path=str(OUT/f"hitel-{key}.png"),full_page=False,timeout=7000)
    except Exception as e:result["screenshotError"]=str(e)[:100]
   if key=="bankSearch" and result["dom"]["nativeHierarchyRoots"]>0:
    try:
     await page.locator('.zb-native-root-head').first.click()
     await page.locator('.zb-native-sub-head').first.click()
     await page.locator('.zb-native-episode').first.click()
     sheet=page.get_by_role("dialog",name="시험지 정보")
     await sheet.wait_for(timeout=10000)
     result["exampleExamSelection"]={
      "id":await sheet.locator('dd').last.inner_text(),
      "link":await sheet.locator("a").first.get_attribute("href"),
      "examsOpenedInHitel":False,
      "hasBodyQuestions":await sheet.locator("[data-question]").count()>0,
     }
    except Exception as e:result["interactionError"]=str(e)[:300]
   if key=="bankDownload":
    try:
     control=page.locator('[data-action="zbOriginalDownload"]').first
     await control.click(timeout=3000)
     result["downloadClick"]={
      "handoffShown":await page.locator(".zocbo-handoff").count()>0,
      "fileDownloadStarted":False,
      "officialContinueUrl":await page.locator('.zocbo-handoff a').first.get_attribute('href') if await page.locator(".zocbo-handoff a").count() else None
     }
    except Exception as e:result["downloadClickError"]=str(e)[:220]
  except Exception as e:result["failure"]=str(e)[:400]
  finally:await ctx.close()
  print("HITEL",key,"HTTP",result.get("httpStatus"),"officialOnly",result.get("dom",{}).get("officialExternalOnly"),"err",result.get("failure"),flush=True)
  return key,result

def classify(original,hitel):
 od=original.get("dom",{})
 hd=hitel.get("dom",{})
 if not od:return "원본 확인 실패(판정 보류)"
 if hitel.get("failure") or not hd:return "HITEL 화면 오류"
 if hd.get("officialExternalOnly",0)>0:return "미연동: 원본 외부 링크 안내만 제공"
 if hd.get("copiedOfficialEventButtons",0)>0:return "부분: 공개자료 DOM 복제, 원본 다운로드 동작 미연결"
 if hd.get("nativeHierarchyRoots",0)>0:return "부분: 원본 단원·회차 데이터 연동, 개별 시험지 본문·다운로드 미연결"
 if hd.get("loginInputs",0)==0 and od.get("passwordFieldPresent",False):return "미연동: 로그인 원본 링크만 제공"
 return "부분/별개 구현: 실제 원본과 동작 동등성 미확인"

async def main():
 report={"scope":{"date":"2026-11-08","original":"m.zocbo.com","hitel":HITEL,"mode":"anonymous-read-only","noLoginOrDownload":True},"original":{},"hitel":{},"comparison":{}}
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--disable-dev-shm-usage","--no-sandbox"])
  sem=asyncio.Semaphore(4)
  official=await asyncio.gather(*[load_original(browser,k,url,sem) for k,url in OFFICIAL.items()])
  report["original"]=dict(official)
  hitel=await asyncio.gather(*[load_hitel(browser,k,target,sem) for k,target in HITEL_ROUTES.items()])
  report["hitel"]=dict(hitel)
  # Discovered official links only: report real homepage/navigation destinations. Do not automatically visit
  # state-changing, cart, purchase, download, or account-management links.
  found={}
  for name in ("mobile_home","app_home","middle_problem","high_problem"):
   for link in report["original"].get(name,{}).get("dom",{}).get("links",[]):
    path=urlparse(link["href"]).path
    if (link["href"].startswith("https://m.zocbo.com/") and path.lower().endswith(('.asp','.html','.aspx')) and not re.search(r'/(_api|api|common|member/logout|pay|payment|charge|download|order|delete|cart)',path,re.I)):
     k=urlparse(link["href"]).path
     found.setdefault(k,{"url":link["href"],"from":[name],"label":link["text"]})
  report["discoveredPublicLinks"]=list(found.values())[:80]
  for key,original_key in HITEL_ROUTES.items():
   if not original_key:
    report["comparison"][key]={"mappedOriginal":None,"classification":"HITEL 자체 기능 / 대응 원본 페이지 없음"}
    continue
   report["comparison"][key]={"mappedOriginal":original_key,"classification":classify(report["original"].get(original_key,{}),report["hitel"].get(key,{}))}
  await browser.close()
 snap(report,"full-audit.json")
 rows=[]
 for key,source in HITEL_ROUTES.items():
  o=report["original"].get(source,{}) if source else {}
  h=report["hitel"].get(key,{})
  status=str(o.get("httpStatus","ERR")) if source else "–"
  rows.append(f"| {key} | {source or '해당 없음'} | {status} | {report['comparison'][key]['classification']} |")
 lines=[
 "# 2026-11-08 족보닷컴 모바일 원본↔HITEL 전체 연결 현황",
 "",
 "측정 방법: GitHub Actions / Playwright / Android 390px Chromium / 공개 페이지 익명 접속. 로그인·실제 다운로드·결제는 실행하지 않았습니다.",
 "",
 "## 기능별 결론",
 "| HITEL 화면 | 원본 기능 | 원본 HTTP | 확인 결과 |",
 "|---|---|---:|---|",*rows,
 "",
 "## 원본 페이지 개별 접속 결과",
 "| 페이지 | HTTP | 최종 주소 | 본문 글자수 | 동적 시험지 DOM 글자수 |",
 "|---|---:|---|---:|---:|",
 ]
 for key,r in report["original"].items():
  dom=r.get("dom",{})
  lines.append(f"| {key} | {r.get('httpStatus','ERR')} | {r.get('resolved','')[:105]} | {dom.get('bodyTextChars',0)} | {dom.get('examMainTextChars',0)} |")
 lines +=[
  "",
  "## 발견된 모바일 원본 링크",
  f"- 공개 홈/목록 화면에서 확인한 별도 경로: {len(found)}건(아래 JSON에 실제 주소 기록). 이는 족보닷컴 전체 내부 URL 수와 동일하지 않습니다.",
  "- 조사한 15개 원본 주소는 HITEL 소스의 PATHS 및 대표 원본 홈페이지에 근거합니다.",
  "- 원본 페이지가 HTTP 200을 반환하는 것만으로 로그인·검색·다운로드 기능이 정상이라는 결론을 내리지 않았습니다.",
  "- 원본 및 HITEL 브라우저 화면 캡처, JS 오류, 원본 AJAX 상태, 공식링크 주소, 다운로드 버튼 클릭 결과는 full-audit.json에 포함하였습니다.",
  "- 페이지 내 인증 후 전개되는 회원전용 화면은 이 익명 조사의 확인 범위 밖입니다.",
 ]
 (OUT/"report.md").write_text("\n".join(lines),encoding="utf8")
 print("FINISHED",json.dumps({"official_pages":len(OFFICIAL),"hitel_pages":len(HITEL_ROUTES),"discovered_paths":len(found),"comparison":{k:v["classification"] for k,v in report["comparison"].items()}},ensure_ascii=False),flush=True)

if __name__=="__main__":
 asyncio.run(main())
