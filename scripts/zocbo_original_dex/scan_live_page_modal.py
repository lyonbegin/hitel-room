#!/usr/bin/env python3
"""Unauthenticated website/source check for the 3 views/day Zocbo free-user modal.
Does not click, login, or open examViewer; never prints credentials or full page data.
"""
from pathlib import Path
from html.parser import HTMLParser
import html,json,re,urllib.request,urllib.error,urllib.parse,ssl,hashlib,os,time

ROOT=Path("evidence/zocbo-original-dex")
ROOT.mkdir(parents=True,exist_ok=True)
MAX_SIZE=2_000_000
phrases=[
 re.compile(r"무료\s*회원.{0,48}?하루.{0,32}?3\s*회.{0,48}?열람", re.S|re.I),
 re.compile(r"하루.{0,32}?3\s*회.{0,48}?열람",re.S|re.I),
 re.compile(r"3\s*회.{0,40}?열람",re.S|re.I),
 re.compile(r"하루.{0,15}?3\s*회",re.S|re.I),
]
markers=["무료회원","무료 회원","3회","3 회","열람할 수 있어요","1일 3","열람 제한","하루 3","freeCount","free_view","viewCount"]
class S(HTMLParser):
 def __init__(self):super().__init__();self.scripts=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.scripts.append(src)

def scan(text,kind,url):
 result={"type":kind,"url":url.split("?")[0],"chars":len(text),
         "marker_counts":{x:text.count(x) for x in markers if text.count(x)>0},
         "phrase_matches":[]}
 for regex in phrases:
  matches=list(regex.finditer(text))
  for m in matches[:6]:
   snippet=text[max(0,m.start()-100):m.end()+100]
   # Only return bounded phrases. Never include HTML/full server user payload.
   if len(snippet)>260:snippet=snippet[:260]
   result["phrase_matches"].append({"pattern":regex.pattern,"excerpt":snippet})
 if len(result["phrase_matches"])>12:result["phrase_matches"]=result["phrase_matches"][:12]
 return result

urls=[
 "https://m.zocbo.com/exam/school/previousExam.asp?search_webview=Y",
 "https://m.zocbo.com/exam/school/previousExam.asp?menu_cd=000010000500001&Subj_code=01&search_grade=1&search_webview=Y&os-type=aos&app_version=4.3.11(2)",
 "https://m.zocbo.com/M/?group=1&menu=1&subject=1",
 "https://m.zocbo.com/",
]
ua="Mozilla/5.0 (Linux; Android 15; SM-F936N Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.260 Mobile Safari/537.36"
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":ua,"Accept":"text/html,application/xhtml+xml,application/javascript,*/*;q=0.8","Accept-Language":"ko-KR,ko;q=0.9,en;q=0.8"})
 try:
  with urllib.request.urlopen(req,timeout=14) as r:
   data=r.read(MAX_SIZE+1)
   ct=r.headers.get("Content-Type","")
   charset=r.headers.get_content_charset() or "utf-8"
   try:txt=data.decode(charset,"replace")
   except LookupError:txt=data.decode("utf-8","replace")
   return {"success":True,"status":r.status,"content_type":ct,"url":r.url,"body":txt[:MAX_SIZE],"truncated":len(data)>MAX_SIZE}
 except urllib.error.HTTPError as e:
  buf=e.read(100000)
  return {"success":False,"status":e.code,"error":"HTTPError","url":e.url,"body":buf.decode("utf-8","replace")}
 except Exception as e:return {"success":False,"error":type(e).__name__+":"+str(e)[:150],"url":url,"body":""}

out={"pages":[],"scripts":[],"apk_static":[]}
unique_js=[]
for u in urls:
 r=fetch(u)
 body=r.pop("body")
 s=scan(html.unescape(body),"html",u)
 s.update({k:v if k!="url" else str(v).split("?")[0] for k,v in r.items()})
 parser=S()
 try:parser.feed(body)
 except Exception:pass
 js=[urllib.parse.urljoin(r.get("url",u),x) for x in parser.scripts]
 js=[x for x in js if urllib.parse.urlparse(x).netloc.endswith("zocbo.com")]
 s["script_url_count"]=len(js)
 s["scripts"]=[x.split("?")[0] for x in js[:50]]
 out["pages"].append(s)
 for src in js:
  if src not in unique_js:unique_js.append(src)
 print("PAGE",json.dumps({k:v for k,v in s.items() if k not in ("scripts",)},ensure_ascii=False),flush=True)

for u in unique_js[:45]:
 r=fetch(u)
 body=r.pop("body")
 s=scan(body,"javascript",u)
 s.update({k:v if k!="url" else str(v).split("?")[0] for k,v in r.items()})
 out["scripts"].append(s)
 if s["phrase_matches"] or s["marker_counts"]:
  print("MATCHED_JS",json.dumps(s,ensure_ascii=False)[:2500],flush=True)
 print("JS_FETCH",s["url"],"ok",s.get("success"),"length",s["chars"],"marker_count",len(s["marker_counts"]),flush=True)

# Scan the exact original APK's decoded resources and smali for native/asset matches.
base=Path("/tmp/zocbo_original_resource")
if base.is_dir():
 for p in base.rglob("*"):
  if not p.is_file():continue
  if not (p.suffix in (".xml",".smali",".js",".html",".htm",".txt",".json") or "assets" in p.parts):continue
  if p.stat().st_size>3_000_000:continue
  try:t=p.read_text("utf-8","replace")
  except Exception:continue
  s=scan(t,"original-apk",str(p.relative_to(base)))
  if s["phrase_matches"] or s["marker_counts"]:
   # Avoid dumping generic all '열람' occurrences if not 3-per-day related.
   if s["phrase_matches"] or any(x in s["marker_counts"] for x in ("무료회원","3회","3 회","1일 3","하루 3","열람할 수 있어요")):
    out["apk_static"].append(s)
print("REPORT_COUNTS",json.dumps({"page_count":len(out["pages"]),"external_js_fetched":len(out["scripts"]),"native_apk_candidates":len(out["apk_static"]),"definitive_text_match":sum(len(x["phrase_matches"]) for a in out.values() for x in a)},ensure_ascii=False),flush=True)
for s in out["apk_static"][:30]:print("APK_CANDIDATE",json.dumps(s,ensure_ascii=False)[:1500],flush=True)
(ROOT/"free_member_three_views_modal_page_audit.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
