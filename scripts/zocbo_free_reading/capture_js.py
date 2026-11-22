#!/usr/bin/env python3
"""Capture anonymous public scripts used by Zocbo free past-exam entry points.
No authentication, cookies, account secrets or protected document downloads.
"""
import hashlib
import html
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit, parse_qsl

import requests
from playwright.sync_api import sync_playwright

ROOT=Path("evidence/zocbo-free-reading")
ROOT.mkdir(parents=True,exist_ok=True)
JSROOT=ROOT/"javascript"
JSROOT.mkdir(exist_ok=True)
FREE="https://m.zocbo.com/Freetrial/FreeReading.asp"
FINAL="https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y"
BRIDGE="https://link.zocbo.com/goWebView/?"+urlencode({"type":"9","url":FINAL})
TARGETS={"free_reading":FREE,"bridge":BRIDGE,"past_exam":FINAL}
UA_DESKTOP="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
UA_MOBILE="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
CHECKS=[
 ("app_identifier",r"navigator\s*\.\s*userAgent|userAgentData|isApp\b|isNative\b|app[_-]?check|application[_-]?version|appVersion|android[_-]?app|is[_-]?webview"),
 ("native_bridge",r"window\s*\.\s*Android\b|JavascriptInterface|addJavascriptInterface|webkit\s*\.\s*messageHandlers|ReactNativeWebView|javascript:|intent:|goWebView"),
 ("exam_data",r"previousexam|freeReading|search_webview|school[_-]?code|school[_-]?id|school[_-]?name|schoolSearch|examList|exam[_-]?list|past[_-]?exam|questionRoom"),
 ("network_code",r"\bfetch\s*\(|\$\.ajax\s*\(|\$\.getJSON\s*\(|axios\s*\.|XMLHttpRequest|\.open\s*\(\s*[\"'](?:GET|POST)"),
]
report={"targets":TARGETS,"http":[],"browser":[],"javascript":[],"matches":[],"errors":[]}
files=set()

def safe_url(url):
    try:
        x=urlsplit(url)
        q=[]
        for k,v in parse_qsl(x.query,keep_blank_values=True):
            if re.search(r"token|password|secret|auth|session|jwt|sign|api[_-]?key|access[_-]?key|credential|authorization",k,re.I):
                v="[redacted]"
            q.append((k,v))
        return urlunsplit((x.scheme,x.netloc,x.path,urlencode(q),x.fragment))
    except Exception:return str(url)[:250]

def save_js(data,url,kind):
    if isinstance(data,str):data=data.encode("utf-8",errors="replace")
    if not data or len(data)>4_000_000:return
    sha=hashlib.sha256(data).hexdigest()
    if sha in files:return
    files.add(sha)
    host=urlsplit(url).hostname or "inline"
    path=urlsplit(url).path or "inline.js"
    path=re.sub(r"[^A-Za-z0-9_.-]","_",host+"_"+path.split("/")[-1])[:70]
    fn=f"{len(files):03d}_{sha[:12]}_{path}.js"
    (JSROOT/fn).write_bytes(data)
    entry={"file":fn,"url":safe_url(url),"kind":kind,"bytes":len(data),"sha256":sha,"matched_lines":0}
    report["javascript"].append(entry)
    lines=data.decode("utf8",errors="replace").splitlines()
    for i,line in enumerate(lines):
        for label,pattern in CHECKS:
            if re.search(pattern,line,re.I):
                entry["matched_lines"]+=1
                if len(report["matches"])<260:
                    report["matches"].append({"file":fn,"line":i+1,"type":label,"excerpt":line.strip()[:500]})
                break

class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__();self.srcs=[];self.inline=[];self.in_script=False;self.buf=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="script":
            attrs=dict(attrs);src=attrs.get("src")
            if src:self.srcs.append(src)
            else:self.in_script=True;self.buf=[]
    def handle_data(self,data):
        if self.in_script:self.buf.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=="script" and self.in_script:
            s="".join(self.buf)
            if s.strip():self.inline.append(s)
            self.in_script=False

session=requests.Session()
session.headers.update({"User-Agent":UA_MOBILE,"Accept":"text/html,application/xhtml+xml,*/*"})
def parse_html(body,base,label):
    if not body:return
    parser=ScriptParser()
    try:parser.feed(body)
    except Exception as e:report["errors"].append(f"HTML parser {label}: {e}")
    for i,s in enumerate(parser.inline):
        save_js(s,base+"#inline"+str(i),"inline_html:"+label)
    for i,src in enumerate(parser.srcs):
        u=urljoin(base,html.unescape(src))
        if urlsplit(u).scheme not in ("http","https"):continue
        try:
            res=session.get(u,timeout=20,allow_redirects=True)
            if res.ok and ("javascript" in res.headers.get("content-type","").lower() or u.lower().split("?")[0].endswith(".js")):
                save_js(res.content,res.url,"script_src:"+label)
            else:
                report["errors"].append(f"script GET status {res.status_code} {safe_url(u)}")
        except Exception as e:report["errors"].append(f"script GET {safe_url(u)} {type(e).__name__}: {str(e)[:120]}")

def http_probe(label,url):
    for ua_name,ua in [("desktop",UA_DESKTOP),("mobile",UA_MOBILE)]:
        try:
            r=session.get(url,headers={"User-Agent":ua},timeout=30,allow_redirects=False)
            ct=r.headers.get("content-type","")
            loc=r.headers.get("location","")
            entry={"label":label,"client":ua_name,"url":safe_url(url),"status":r.status_code,"content_type":ct,"location":safe_url(urljoin(url,loc)) if loc else None,"bytes":len(r.content)}
            report["http"].append(entry)
            if "html" in ct.lower():
                (ROOT/f"http_{label}_{ua_name}.html").write_bytes(r.content[:2_000_000])
                parse_html(r.text,r.url,f"{label}-{ua_name}")
        except Exception as e:report["errors"].append(f"HTTP {label}/{ua_name}: {type(e).__name__}: {str(e)[:200]}")

for name,url in TARGETS.items():http_probe(name,url)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,args=["--no-sandbox"])
    for client,ua,mobile in [("desktop",UA_DESKTOP,False),("mobile",UA_MOBILE,True)]:
        context=browser.new_context(user_agent=ua,is_mobile=mobile,viewport={"width":390 if mobile else 1280,"height":844 if mobile else 800},device_scale_factor=2 if mobile else 1,locale="ko-KR",ignore_https_errors=False,accept_downloads=False)
        for label,url in TARGETS.items():
            page=context.new_page()
            responses=[];req_failed=[];console=[]
            page.on("response",lambda response:responses.append(response))
            page.on("requestfailed",lambda req:req_failed.append({"url":safe_url(req.url),"failure":req.failure}))
            page.on("console",lambda message:console.append({"type":message.type,"text":message.text[:240]}) if len(console)<15 else None)
            status=None;err=None
            try:
                res=page.goto(url,wait_until="domcontentloaded",timeout=25000)
                status=res.status if res else None
                page.wait_for_timeout(4500)
            except Exception as e:
                err=str(e)[:330]
                try:page.wait_for_timeout(1500)
                except Exception:pass
            endurl=page.url
            content=""
            try:content=page.content()
            except Exception as e:report["errors"].append(f"page.content {label}/{client}: {str(e)[:110]}")
            if content:
                (ROOT/f"browser_{label}_{client}.html").write_text(content[:2_000_000],encoding="utf8")
                parse_html(content,endurl,f"browser-{label}-{client}")
            for resp in responses:
                try:
                    typ=resp.request.resource_type
                    ct=resp.headers.get("content-type","").lower()
                    src=resp.url
                    if typ=="script" or "javascript" in ct:
                        if resp.status==200:save_js(resp.body(),src,f"browser:{label}-{client}")
                    elif typ in ("xhr","fetch") and "zocbo.com" in (urlsplit(src).hostname or ""):
                        # Endpoint names/status only; never save private or protected responses.
                        report.setdefault("data_requests",[]).append({"page":label,"client":client,"url":safe_url(src),"status":resp.status,"content_type":ct})
                except Exception as e:report["errors"].append(f"response {safe_url(resp.url)}: {str(e)[:140]}")
            report["browser"].append({"label":label,"client":client,"start":safe_url(url),"final_url":safe_url(endurl),"status":status,"error":err,"response_count":len(responses),"failed_requests":req_failed[:30],"console":console})
            page.close()
        context.close()
    browser.close()

(ROOT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
print("=== ZOCBO FREE READING JS AUDIT ===")
for row in report["http"]:print("HTTP",json.dumps(row,ensure_ascii=False))
for row in report["browser"]:print("BROWSER",json.dumps({k:v for k,v in row.items() if k not in ("failed_requests","console")},ensure_ascii=False))
print("JS_FILES",len(report["javascript"]),"MATCHES",len(report["matches"]),"ERRORS",len(report["errors"]))
for row in report.get("data_requests",[])[:70]:print("XHR_FETCH",json.dumps(row,ensure_ascii=False))
for row in report["javascript"]:print("JS",json.dumps(row,ensure_ascii=False))
for row in report["matches"][:150]:print("MATCH",json.dumps(row,ensure_ascii=False))
for error in report["errors"][:40]:print("ERROR",error)
