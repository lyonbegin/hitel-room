#!/usr/bin/env python3
"""Audit publicly visible Gooroomee pages with real Chromium; no sign-in."""
import hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path("gooroomee-public-audit-evidence"); OUT.mkdir(parents=True,exist_ok=True)
URLS=[
  ("camstudy_desktop","https://gooroomee.com/intro",False),
  ("camstudy_mobile","https://gooroomee.com/intro",True),
  ("guide_room_create","https://camsguide.gooroomee.com/1e4b5339-2454-8003-923d-cc5f2cc3772c",True),
  ("guide_index","https://camsguide.gooroomee.com/803dcab3-c86f-4c94-8be2-893d16f6baf1",False)]
DOM_JS="""() => ({
  url:location.href, title:document.title,
  headings:[...document.querySelectorAll('h1,h2,h3')].slice(0,90).map(x=>({tag:x.tagName,text:x.innerText.trim().slice(0,180)})),
  controls:[...document.querySelectorAll('a[href],button,[role=button],input,select')].slice(0,300).map(x=>({
    tag:x.tagName,text:(x.innerText||x.value||x.getAttribute('aria-label')||'').trim().slice(0,150),
    href:x.getAttribute('href'),type:x.getAttribute('type')})),
  scripts:[...document.querySelectorAll('script[src]')].map(x=>x.src),
  css:[...document.querySelectorAll('link[rel=stylesheet]')].map(x=>x.href),
  forms:[...document.forms].map(x=>({method:x.method,action:x.getAttribute('action')})),
  bodyText:(document.body?.innerText||'').slice(0,25000),
  overflow:document.documentElement.scrollWidth>innerWidth
})"""
sha=lambda b: hashlib.sha256(b).hexdigest()
result={"captured_at_utc":datetime.now(timezone.utc).isoformat(),
        "method":"Chromium Playwright; unauthenticated web pages; HTML, rendered DOM, source JS/CSS, HTTP response metadata, screenshots",
        "limitations":["No authentication or nonpublic room entered","JS string presence does not prove a feature","API routes observed only when actual network requests occur"],
        "pages":[],"assets":[],"errors":[]}
seen=set()
terms=["RTCPeerConnection","getUserMedia","WebSocket","socket.io","stomp","graphql","studyRoom","attendance","calendar","schedule","timer","roomId","goalTime","studyTime","axios"]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 for label,url,mobile in URLS:
  item={"name":label,"requested_url":url,"mobile":mobile,"responses":[],"js_errors":[]}
  context=browser.new_context(viewport={"width":390,"height":844} if mobile else {"width":1365,"height":900},is_mobile=mobile,has_touch=mobile,locale="ko-KR")
  page=context.new_page()
  page.on("pageerror",lambda e,item=item:item["js_errors"].append(str(e)[:250]))
  def add_response(r,item=item):
   if len(item["responses"])<500:
    item["responses"].append({"url":r.url,"status":r.status,"contentType":r.headers.get("content-type","")[:100]})
  page.on("response",add_response)
  try:
   resp=page.goto(url,wait_until="domcontentloaded",timeout=45000)
   item["http_status"]=resp.status if resp else None
   page.wait_for_timeout(4500)
   item["dom"]=page.evaluate(DOM_JS)
   raw=page.content().encode("utf-8")
   item["html_sha256"]=sha(raw)
   (OUT/(label+".html")).write_bytes(raw)
   page.screenshot(path=str(OUT/(label+".png")),full_page=True,timeout=25000)
   item["screenshot"]=label+".png"
  except Exception as e:
   item["error"]=str(e)[:500]; result["errors"].append({"name":label,"error":item["error"]})
   try:
    item["dom"]=page.evaluate(DOM_JS)
    (OUT/(label+".html")).write_text(page.content(),encoding="utf-8")
   except Exception:pass
  dom=item.get("dom",{})
  for asset in (dom.get("scripts",[])+dom.get("css",[])):
   if len(result["assets"])>=50 or asset in seen:continue
   seen.add(asset)
   domain=urlparse(asset).hostname or ""
   if domain!="gooroomee.com" and not domain.endswith(".gooroomee.com"):continue
   a={"url":asset,"first_seen_on":label}
   try:
    r=context.request.get(asset,timeout=16000);b=r.body()
    a.update({"http_status":r.status,"bytes":len(b),"sha256":sha(b),"contentType":r.headers.get("content-type","")})
    if r.ok and len(b)<=5000000 and (".js" in asset or ".css" in asset):
     ext=".css" if (".css" in asset and ".js" not in asset) else ".js"
     filename="public_asset_"+str(len(result["assets"])+1).zfill(3)+"_"+a["sha256"][:12]+ext
     (OUT/filename).write_bytes(b);a["saved_file"]=filename
     if ext==".js":
      s=b.decode("utf-8","replace")
      a["keyword_counts"]={t:len(re.findall(re.escape(t),s,re.I)) for t in terms if re.search(re.escape(t),s,re.I)}
   except Exception as e:a["error"]=str(e)[:250]
   result["assets"].append(a)
  result["pages"].append(item)
  context.close()
 browser.close()
(OUT/"audit.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
lines=["# 구루미 캠스터디 공개 사이트 원본 증거 보고","",
 "- 출처: 실제 Chromium 페이지와 다운로드한 공개 JS/CSS","- 로그인 및 계정 생성/방 생성은 수행하지 않음",
 "- 원본 내부 서버 코드와 비공개 API는 확보 대상 아님","",
 "## 실제 페이지"]
for i in result["pages"]:
 d=i.get("dom",{})
 lines+=["","### "+i["name"],
 "요청 URL: "+i["requested_url"],"최종 URL: "+d.get("url","미확인"),
 "HTTP: "+str(i.get("http_status","미확인")),"HTML SHA256: "+str(i.get("html_sha256","미확인")),
 "브라우저 화면 원문: "+d.get("bodyText","")[:750].replace("\n"," / "),
 "원본 버튼 및 링크 수: "+str(len(d.get("controls",[]))),
 "JS 개수: "+str(len(d.get("scripts",[]))),"CSS 개수: "+str(len(d.get("css",[]))),
 "네트워크 응답 수: "+str(len(i.get("responses",[]))),"오류: "+str(i.get("error","없음"))]
lines+=["","## 공개 JS/CSS 다운로드 실측 파일"]
for a in result["assets"]:
 lines+=["- "+a["url"]+" | HTTP "+str(a.get("http_status","실패"))+" | bytes "+str(a.get("bytes","미확인"))+" | SHA256 "+str(a.get("sha256","미확인"))+" | 파일 "+str(a.get("saved_file","없음"))+" | 키워드 "+json.dumps(a.get("keyword_counts",{}),ensure_ascii=False)]
lines+=["","## 한계","로그인 후 실제 그룹 데이터 구조와 그룹 스케줄 API는 확인했다고 주장하지 않습니다.","자세한 메뉴 텍스트와 실제 요청 URL은 audit.json 원본을 근거로 확인하십시오."]
(OUT/"REPORT.md").write_text("\n".join(lines),encoding="utf-8")
print("GOOROOMEE_SOURCE_AUDIT_RESULT "+json.dumps({
 "pages":[{"name":x["name"],"status":x.get("http_status"),"final_url":x.get("dom",{}).get("url"),"scripts":len(x.get("dom",{}).get("scripts",[])),"controls":len(x.get("dom",{}).get("controls",[])),"error":x.get("error")} for x in result["pages"]],
 "public_assets":len(result["assets"]),"downloaded_sources":sum(bool(a.get("saved_file")) for a in result["assets"]),"errors":result["errors"]},ensure_ascii=False))
