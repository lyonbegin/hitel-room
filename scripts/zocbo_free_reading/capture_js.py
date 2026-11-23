#!/usr/bin/env python3
"""Capture ACTUAL public JavaScript response bodies with Chrome DevTools Network.
This makes one browser session per URL; not a site crawler.
No login, bypass, cookie export or protected-document download.
"""
import base64
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote, urlsplit, urlencode, parse_qsl, urlunsplit
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

ROOT=Path("evidence/zocbo-free-reading")
JS=ROOT/"javascript"
JS.mkdir(parents=True,exist_ok=True)
URLS={
  "actual_exam_page":"https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y",
}
MOBILE="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
DESKTOP="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
PATS={
 "app_detection":r"userAgent|userAgentData|Android|WebView|isApp|isNative|navigator\.platform|window\.webkit|JavascriptInterface|ReactNativeWebView|app[_-]?check|is[_-]?app",
 "native_bridge":r"window\s*\.\s*Android\b|window\s*\.\s*webkit\b|goWebView|intent:|javascript:|openApp|appScheme",
 "exam_search":r"previousexam|school[_-]?(id|code|name)|schoolSearch|schoolList|exam[_-]?(id|list)|search_webview|freeReading|questionRoom",
 "ajax":r"XMLHttpRequest|fetch\s*\(|axios\.|\$\.ajax\s*\(|\$\.getJSON\s*\(",
}
report={"target_urls":URLS,"captures":[],"scripts":[],"findings":[],"errors":[]}
seen=set()

def redact(url):
 try:
  sp=urlsplit(url); q=[]
  for k,v in parse_qsl(sp.query,keep_blank_values=True):
   if re.search("token|secret|auth|password|session|key|jwt|signature",k,re.I):v="[redacted]"
   q.append((k,v))
  return urlunsplit((sp.scheme,sp.netloc,sp.path,urlencode(q),sp.fragment))
 except Exception:return str(url)[:250]

def add_js(url,data,kind):
 if isinstance(data,str):data=data.encode("utf8")
 if not data or len(data)>6_000_000:return
 sha=hashlib.sha256(data).hexdigest()
 if sha in seen:return
 seen.add(sha)
 host=urlsplit(url).hostname or "inline"
 basename=urlsplit(url).path.rsplit("/",1)[-1] or "inline"
 basename=re.sub("[^A-Za-z0-9_.-]","_",basename)[:65]
 name=f"{len(seen):03d}_{sha[:14]}_{host}_{basename}.js"
 (JS/name).write_bytes(data)
 report["scripts"].append({"file":name,"from_url":redact(url),"kind":kind,"size":len(data),"sha256":sha})
 for i,line in enumerate(data.decode("utf8","replace").splitlines(),1):
  if len(report["findings"])>=450:break
  for namekey,pattern in PATS.items():
   if re.search(pattern,line,re.I):
    report["findings"].append({"file":name,"line":i,"category":namekey,"source":line.strip()[:420]})
    break

class InlineScriptParser(HTMLParser):
 def __init__(self):super().__init__();self.in_script=False;self.buf=[];self.inline=[]
 def handle_starttag(self,tag,attrs):
  if tag.lower()=="script":
   a=dict(attrs)
   if not a.get("src"):self.in_script=True;self.buf=[]
 def handle_data(self,data):
  if self.in_script:self.buf.append(data)
 def handle_endtag(self,tag):
  if tag.lower()=="script" and self.in_script:
   code="".join(self.buf)
   if code.strip():self.inline.append(code)
   self.in_script=False

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 for platform,ua,is_mobile in [("desktop",DESKTOP,False)]:
  context=browser.new_context(user_agent=ua,is_mobile=is_mobile,viewport={"width":390 if is_mobile else 1280,"height":844 if is_mobile else 800},locale="ko-KR")
  for key,target in URLS.items():
   page=context.new_page()
   page.set_default_timeout(6000)
   print(f"OPEN {key} {platform} {target}",flush=True)
   cdp=context.new_cdp_session(page)
   cdp.send("Network.enable",{"maxTotalBufferSize":50000000,"maxResourceBufferSize":10000000})
   requests={};loaded=set();browser_events=[]
   def will_send(v):
    rid=v.get("requestId")
    if rid:
     requests.setdefault(rid,{})["url"]=v.get("request",{}).get("url","")
     if v.get("redirectResponse"):
      rd=v["redirectResponse"];browser_events.append({"event":"redirect","url":redact(rd.get("url","")),"status":rd.get("status"),"location":redact(rd.get("headers",{}).get("location",""))})
   def got_resp(v):
    rid=v.get("requestId")
    if rid:
     rd=v.get("response",{})
     requests.setdefault(rid,{}).update({"url":rd.get("url",""),"mime":rd.get("mimeType",""),"status":rd.get("status"),"type":v.get("type"),"headers":rd.get("headers",{})})
   def finished(v):loaded.add(v.get("requestId"))
   cdp.on("Network.requestWillBeSent",will_send)
   cdp.on("Network.responseReceived",got_resp)
   cdp.on("Network.loadingFinished",finished)
   err=None;status=None
   try:
    response=page.goto(target,wait_until="commit",timeout=12000)
    status=response.status if response else None
    page.wait_for_timeout(2000)
   except Exception as exc:
    err=str(exc)[:300]
   final=page.url
   print(f"NAVIGATED {key} {platform} status={status} final={redact(final)} error={err}",flush=True)
   html=""
   try:
    html=page.content()
    (ROOT/f"{key}_{platform}.html").write_text(html,encoding="utf8")
    parser=InlineScriptParser();parser.feed(html)
    for i,code in enumerate(parser.inline):
     add_js(final+f"#inline-{i}",code,"inline_script")
   except Exception as exc:report["errors"].append(f"DOM {key}/{platform}: {str(exc)[:210]}")
   row={"label":key,"platform":platform,"start_url":redact(target),"final_url":redact(final),"status":status,"navigation_error":err,"resources":[],"redirects":browser_events}
   for reqid,rec in requests.items():
    url=rec.get("url","")
    typ=rec.get("type","")
    mime=rec.get("mime","")
    resource={"url":redact(url),"status":rec.get("status"),"mime":mime,"type":typ,"finished":reqid in loaded}
    row["resources"].append(resource)
    if reqid not in loaded or rec.get("status")!=200:continue
    is_js=typ=="Script" or "javascript" in mime.lower() or urlsplit(url).path.lower().endswith(".js")
    if not is_js:continue
    try:
     body=cdp.send("Network.getResponseBody",{"requestId":reqid})
     data=base64.b64decode(body["body"]) if body.get("base64Encoded") else body.get("body","").encode("utf8")
     add_js(url,data,f"ChromeDevTools:{platform}:{key}")
     resource["script_saved"]=True
    except Exception as exc:
     resource["script_saved"]=False
     report["errors"].append(f"Network.getResponseBody {redact(url)}: {str(exc)[:200]}")
   report["captures"].append(row)
   print(json.dumps({"page":key,"browser":platform,"http_status":status,"final_url":redact(final),"resources":len(row["resources"]),"scripts_total":len(report["scripts"]),"error":err},ensure_ascii=False),flush=True)
   cdp.detach()
   page.close()
  context.close()
 browser.close()
(ROOT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
print("ACTUAL_DOWNLOADED_JS_FILES",len(report["scripts"]),flush=True)
print("APP_DETECTION_MATCHES",sum(x["category"]=="app_detection" for x in report["findings"]),flush=True)
print("EXAM_SEARCH_MATCHES",sum(x["category"]=="exam_search" for x in report["findings"]),flush=True)
for finding in report["findings"][:70]:print("JS_MATCH",json.dumps(finding,ensure_ascii=False),flush=True)
for err in report["errors"][:40]:print("CAPTURE_ERROR",err,flush=True)
if not report["scripts"]:
 raise SystemExit("FAILED: Chrome DevTools did not capture a single JavaScript response")
