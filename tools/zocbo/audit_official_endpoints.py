#!/usr/bin/env python3
"""Read-only public Zocbo connection audit. Does not authenticate or trigger downloads."""
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.parse import urlparse,urlencode
from bs4 import BeautifulSoup
from pathlib import Path
import requests,json,re
O=Path("zocbo-audit");O.mkdir(exist_ok=True)
BASE="https://m.zocbo.com"
URL={
"app_home":BASE+"/app/main_v2.asp",
"login":BASE+"/Member/login.asp",
"public_download_list":BASE+"/event/pre-test2026d/",
"free_reading":BASE+"/Freetrial/FreeReading.asp",
"free_reading_web":BASE+"/exam/school/previousexam.asp?search_webview=Y",
"middle_math":BASE+"/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT",
"middle_english":BASE+"/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=EG",
"middle_korean":BASE+"/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=KR",
"high_math":BASE+"/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT",
"high_english":BASE+"/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=EG",
"expected_middle":BASE+"/M/expected.asp",
"expected_high":BASE+"/H/expected.asp",
"learning_test":BASE+"/Freetrial/learningtest.asp"
}
def audit(key,url):
 try:
  r=requests.get(url,headers={"User-Agent":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36"},timeout=26,allow_redirects=True)
  soup=BeautifulSoup(r.text,"html.parser")
  buttons=soup.select("[data-act='sampleDown']")
  return key,{"requested":url,"status":r.status_code,"redirects":[{"status":v.status_code,"url":v.url,"location":v.headers.get("location","")} for v in r.history],"final_url":r.url,"content_type":r.headers.get("Content-Type",""),"x_frame_options":r.headers.get("X-Frame-Options",""),"content_security_policy":r.headers.get("Content-Security-Policy","")[:500],"title":soup.title.get_text(" ",strip=True) if soup.title else "","password_fields":len(soup.select('input[type="password"]')),"forms":len(soup.select("form")),"sample_download_controls":len(buttons),"sample_download_examples":[{k:b.get("data-"+k) for k in ["src","act","grade","siteid","subjcode","term"]} for b in buttons[:8]],"html_bytes":len(r.content),"body_excerpt":soup.get_text(" ",strip=True)[:300]}
 except Exception as e:return key,{"requested":url,"error":str(e)}
with ThreadPoolExecutor(max_workers=5) as pool:
 futs=[pool.submit(audit,k,v) for k,v in URL.items()]
 result=dict(f.result() for f in as_completed(futs))
(O/"endpoints.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
for k in URL:
 x=result[k];print(f"{k:24s} {x.get('status','ERR')} {x.get('final_url',x.get('error',''))[:120]} :: download_controls={x.get('sample_download_controls')}, password_fields={x.get('password_fields')}, XFO={x.get('x_frame_options')!r}")
