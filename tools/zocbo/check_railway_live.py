#!/usr/bin/env python3
"""Smoke-test the real deployed Railway URL (GET only), not a localhost mock."""
import json
import urllib.request
import urllib.error
from urllib.parse import urlencode
BASE="https://hitel-zocbo-live-bank-production.up.railway.app"
def get(path):
 try:
  with urllib.request.urlopen(urllib.request.Request(BASE+path,headers={"User-Agent":"HITEL-QA/1.0"}),timeout=35) as r:
   return r.status,r.read()
 except urllib.error.HTTPError as e:
  raise RuntimeError(f"HTTP {e.code} for {path}: "+e.read().decode("utf-8",errors="replace")[:600])
code,raw=get("/health")
health=json.loads(raw)
assert code==200 and health.get("ok")==True and health.get("zocboOriginalInline")==True,health
code,html=get("/")
assert code==200 and b"zocbo-live-bank.js" in html,("wrong deployment branch",code,len(html))
code,js=get("/zocbo-live-bank.js")
assert code==200 and b"zbLiveSubject" in js,("live module missing",code,len(js))
for name,filters,expected in [
 ("high",{"site":"H","grade":"1","subject":"MT"},411),
 ("middle",{"site":"M","grade":"2","subject":"MT"},383),
]:
 code,raw=get("/api/zocbo/public-catalog?"+urlencode(filters))
 data=json.loads(raw)
 n=len(data.get("exams",[]))
 print(json.dumps({"case":name,"http":code,"ok":data.get("ok"),"examCount":n,"partRows":len(data.get("parts",[])),"firstTitle":data.get("exams",[{}])[0].get("title")},ensure_ascii=False))
 assert code==200 and data.get("ok")==True and n==expected,(name,n,raw[:200])
print("RAILWAY_LIVE_API_SUCCESS",BASE)
