#!/usr/bin/env python3
"""Fetch official publicly visible original Zocbo mobile image assets via
Chromium network. Images are exact bytes captured from the source website;
no screenshot substitution, fabricated art, or user-private media.
"""
import hashlib,json,re
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
OUT=Path('public/zocbo-source-assets')
OUT.mkdir(parents=True,exist_ok=True)
URL='https://m.zocbo.com'
PAGES=[
 '/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=EG&grade=3',
 '/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT&grade=1']
PATHS=[
 '/images/mo/banner/banner-learning3Q-public.png',
 '/images/mo/banner/banner-learning3Q-m1.png',
 '/images/mo/banner/banner-learning3Q-m2.png',
 '/images/mo/banner/banner-learning3Q-m3.png',
 '/images/mo/banner/banner-learning3Q-h1.png',
 '/images/mo/banner/banner-learning3Q-h2.png',
 '/images/mo/ico_fixedMen_home.svg',
 '/images/mo/ico_fixedMen_home_on.svg',
 '/images/mo/ico_fixedMen_mid.svg',
 '/images/mo/ico_fixedMen_mid_on.svg',
 '/images/mo/ico_fixedMen_high.svg',
 '/images/mo/ico_fixedMen_high_on.svg',
 '/images/mo/ico_fixedMen_soopring.svg',
 '/images/mo/ico_fixedMen_soopring_on.svg',
 '/cloudfront/images/mo/img_logoTop.svg',
 '/cloudfront/images/mo/ico_coupon.svg']
report={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=ctx.new_page()
 observed={}
 def onres(r):
  try:
   u=r.url
   for path in PATHS:
    if path in u and r.status==200 and path not in observed:
     raw=r.body()
     if len(raw)>100:observed[path]=raw
  except Exception:pass
 page.on('response',onres)
 for path in PAGES:
  page.goto(URL+path,wait_until='domcontentloaded',timeout=27000)
  page.wait_for_timeout(1600)
 for path in PATHS:
  name=path.split('/')[-1]
  raw=observed.get(path)
  method='captured-original-browser-network' if raw else 'authenticated-anonymous-original-request'
  if raw is None:
   try:
    r=ctx.request.get(URL+path,headers={'Referer':URL+PAGES[0],'Accept':'image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8'},timeout=25000)
    if r.ok:raw=r.body()
   except Exception as e:report[path]={'error':str(e)[:130]}
  is_img=bool(raw and (raw.startswith(b'\x89PNG\r\n\x1a\n') or raw.lstrip().startswith(b'<svg') or b'<svg' in raw[:300]))
  if is_img:
   (OUT/name).write_bytes(raw)
   report[path]={'ok':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'filename':name,'method':method}
  else:
   report[path]={'ok':False,'bytes':len(raw) if raw else 0,'error':report.get(path,{}).get('error','INVALID_SOURCE_IMAGE')}
  print('ORIGINAL_ASSET',path,report[path],flush=True)
 ctx.close();browser.close()
(OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
if not report['/images/mo/banner/banner-learning3Q-public.png']['ok']:
 raise SystemExit('FAIL: original public mobile banner not downloaded; never replace with an invented image')
