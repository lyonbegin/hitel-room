#!/usr/bin/env python3
"""Anonymous actual mobile-original pages vs HITEL page-level integration audit.
Only GET navigation; no login, purchase, download, or POST actions.
The report explicitly distinguishes 'page reached', 'live functional', and 'link-only'.
"""
import json, os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=os.environ.get("HITEL_BASE_URL","http://127.0.0.1:3000").rstrip("/")
OUT=Path("zocbo-coverage-evidence")
OUT.mkdir(exist_ok=True)

ORIGINAL={
"app-home":"https://m.zocbo.com/app/main_v2.asp",
"mobile-home":"https://m.zocbo.com/",
"login":"https://m.zocbo.com/Member/login.asp",
"middle-exam-list":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT",
"high-exam-list":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT",
"middle-concept":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT",
"high-concept":"https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=MT",
"middle-school-expected":"https://m.zocbo.com/M/expected.asp",
"high-school-expected":"https://m.zocbo.com/H/expected.asp",
"school-free-reading":"https://m.zocbo.com/Freetrial/FreeReading.asp",
"school-free-reading-web":"https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y",
"finals-free":"https://m.zocbo.com/event/pre-test2026d/",
"diagnostic":"https://m.zocbo.com/Freetrial/learningtest.asp",
"revision":"https://m.zocbo.com/guide/revision/default_M.asp",
"member-benefits":"https://m.zocbo.com/Freetrial/main_s.asp"
}
SCREENS=["bankHome","bankSearch","bankResults","bankPaper","bankOriginal","bankLogin","bankSchool","bankFree","bankDownload","bankSaved","bankDiagnostic","bankCategory"]
report={"source":"Playwright 390px chromium, unauthenticated mobile browser","origin":ROOT,"official":{},"hitel":{},"bottomNavigation":{},"discoveredOfficialLinks":[]}
discovered=set()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--disable-dev-shm-usage","--no-sandbox"])
 ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR",user_agent="Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36")
 page=ctx.new_page()
 page.set_default_timeout(15000)
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)[:300]))
 for key,url in ORIGINAL.items():
  entry={"requestedUrl":url}
  try:
   result=page.goto(url,wait_until="domcontentloaded",timeout=25000)
   page.wait_for_timeout(1400 if key not in ("app-home","middle-exam-list","high-exam-list","finals-free") else 4200)
   detail=page.evaluate("""() => {
    const exam=document.querySelector('#examMain');
    const links=[...document.querySelectorAll('a[href]')].map(a=>({title:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,65),url:a.href})).filter(x=>x.url.startsWith('https://m.zocbo.com/'));
    return {title:document.title,url:location.href,textSize:(document.body?.innerText||'').trim().length,
      mainText:(document.querySelector('main')?.innerText||document.body?.innerText||'').trim().slice(0,120),
      examRootPresent:!!exam,examChildren:exam?.children.length||0,
      eventDownloadButtons:document.querySelectorAll('[data-act="sampleDown"]').length,
      activeButtons:document.querySelectorAll('button,select,input').length,
      formCount:document.forms.length,
      sameOriginLinks:links.slice(0,100),
      iframeCount:document.querySelectorAll('iframe').length};
   }""")
   entry.update({"http":result.status if result else None,**{k:v for k,v in detail.items() if k!="sameOriginLinks"},"linkCount":len(detail["sameOriginLinks"])})
   for link in detail["sameOriginLinks"]:
    if link["title"] and "/logout" not in link["url"].lower() and "/checkout" not in link["url"].lower():
     discovered.add((link["title"],link["url"].split("#")[0]))
   if key in ("app-home","middle-exam-list","high-exam-list","finals-free","login"):
    page.screenshot(path=str(OUT/(key+".png")),full_page=False)
  except Exception as exc:
   entry["error"]=str(exc)[:420]
  report["official"][key]=entry
  print("OFFICIAL",key,entry.get("http"),entry.get("url"),entry.get("textSize"),entry.get("error",""),flush=True)
 page.goto(ROOT+"/?screen=home",wait_until="domcontentloaded",timeout=40000)
 page.wait_for_timeout(1200)
 btn=page.locator('#phone nav.bottomnav button').filter(has_text="문제은행")
 report["bottomNavigation"]["buttonCount"]=btn.count()
 if btn.count():
  report["bottomNavigation"]["before"]=page.url
  report["bottomNavigation"]["buttonTarget"]=btn.first.get_attribute("data-go")
  btn.first.click(timeout=10000)
  page.wait_for_timeout(2800)
  report["bottomNavigation"]["after"]=page.url
  report["bottomNavigation"]["searchPageVisible"]=page.locator("#phone .zb-native-bank").count()>0
  report["bottomNavigation"]["originalExamSummary"]=page.locator("#phone .zb-native-summary").inner_text() if page.locator("#phone .zb-native-summary").count() else None
  page.screenshot(path=str(OUT/"bottom-bank-click.png"),full_page=False)
 for screen in SCREENS:
  item={"screen":screen}
  try:
   page.goto(ROOT+"/?screen="+screen,wait_until="domcontentloaded",timeout=35000)
   page.wait_for_timeout(1200 if screen not in ("bankSearch","bankResults","bankDownload") else 2800)
   item.update(page.evaluate("""() => {
    const host=document.querySelector('#phone .appscroll'),html=host?.innerText||'';
    const links=[...document.querySelectorAll('#phone .appscroll a[href]')].map(a=>({text:a.innerText.trim().slice(0,75),href:a.href}));
    const buttons=[...document.querySelectorAll('#phone .appscroll button')].map(x=>({text:x.innerText.trim().slice(0,55),action:x.dataset.action||null,go:x.dataset.go||null}));
    return {url:location.href,contentChars:html.length,preview:html.trim().slice(0,170),
     liveBank:!!host?.querySelector('.zb-native-bank'),officialEvent:!!host?.querySelector('.zb-inline-root'),
     infoOnly:!!host?.querySelector('.zocbo-native-handoff'),iframeCount:host?.querySelectorAll('iframe').length||0,
     linkCount:links.length,externalLinks:links.filter(x=>x.href.includes('zocbo.com')).slice(0,10),
     buttonCount:buttons.length,interactive:buttons.slice(0,20),
     hasNoContent:html.trim().length<15};
    }"""))
  except Exception as exc:
   item["error"]=str(exc)[:350]
  report["hitel"][screen]=item
  print("HITEL",screen,item.get("contentChars"),"live=",item.get("liveBank"),"infoOnly=",item.get("infoOnly"),"error=",item.get("error",""),flush=True)
 report["discoveredOfficialLinks"]=[{"name":n,"url":u} for n,u in sorted(discovered)][:200]
 report["browserErrors"]=errors[:30]
 ctx.close();browser.close()
(OUT/"report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf8")
s=report["bottomNavigation"]
print("BOTTOM_NAV",json.dumps(s,ensure_ascii=False),flush=True)
# Fail only the actual function requested; individual inaccessible official pages remain reportable.
assert s.get("buttonCount")==1,("bottom nav missing",s)
assert s.get("buttonTarget")=="bankSearch",("bottom bank route is not the live bank",s)
assert s.get("searchPageVisible"),("bottom nav did not open live bank",s)
assert "bankSearch" in s.get("after",""),("bottom nav URL not updated",s)
assert "411" in (s.get("originalExamSummary") or ""),("real source dataset not loaded via bottom nav",s)
