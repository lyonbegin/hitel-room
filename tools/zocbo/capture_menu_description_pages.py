#!/usr/bin/env python3
"""Capture public ORIGINAL mobile Zocbo help/guide pages by exact menu_cd.

The official mobile source menuCLS.goMenuDescriptionWeb constructs:
 /exam/menuDescriptionWeb.asp?menu_cd=<current original code>.
No login or paid page access. Sanitize scripts/iframes/forms/event handlers
and keep actual content/assets, never fabricate a guide paragraph.
"""
import json,re
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
OUT=Path('public/zocbo-guide-pages')
OUT.mkdir(parents=True,exist_ok=True)
codes={
 'M':["000010000100001","000010000100004","000010000200003","000010000200002",
      "000010000300001","000010000300002","000010000300003","000010000300004",
      "000010000300008","000010000300009","000010000400001"],
 'H':["000020000100001","000020000200003","000020000300001","000020000400001"]
}
report={}
def clean(s):
 root=BeautifulSoup(s,'html.parser')
 for x in list(root.find_all(True)):
  if x.name in ('script','style','iframe','form','object','embed','svg','noscript'):
   x.decompose();continue
  for attr in list(x.attrs):
   if attr.startswith('on') or attr in ('srcset','srcdoc'):del x[attr]
  for attr in ('src','href'):
   val=x.get(attr)
   if not isinstance(val,str):continue
   if val.startswith('/'):x[attr]='https://m.zocbo.com'+val
   elif val.startswith(('javascript:','data:','#')):del x[attr]
 return str(root)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=c.new_page()
 for site,group in codes.items():
  for code in group:
   url='https://m.zocbo.com/exam/menuDescriptionWeb.asp?menu_cd='+code
   o={'menu_cd':code,'site':site,'source':url}
   try:
    r=page.goto(url,wait_until='domcontentloaded',timeout=26000)
    page.wait_for_timeout(600)
    o.update(page.evaluate("""() => ({
      finalURL:location.href,title:document.title,
      visibleLength:document.body?.innerText?.trim().length||0,
      mainText:(document.querySelector('#section')?.innerText||document.querySelector('#contents')?.innerText||document.body?.innerText||'').trim().slice(0,4500),
      originalContent:document.querySelector('#section')?.outerHTML||document.querySelector('#contents')?.outerHTML||document.querySelector('.content')?.outerHTML||''
    })"""))
    o['status']=r.status if r else 0
    o['html']=clean(o.pop('originalContent',''))
    o['isValid']=o['status']==200 and len(o['html'])>200 and o['visibleLength']>60
   except Exception as e:o['error']=str(e)[:250];o['isValid']=False
   (OUT/(code+'.json')).write_text(json.dumps(o,ensure_ascii=False,separators=(',',':')),encoding='utf8')
   report[code]={'status':o.get('status'),'valid':o['isValid'],'bytes':len(o.get('html','')),'textLength':o.get('visibleLength'),'error':o.get('error')}
   print('ORIGINAL_GUIDE',code,report[code],flush=True)
 c.close();b.close()
(OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('ORIGINAL_GUIDE_CAPTURED',len(report),'valid',sum(v['valid'] for v in report.values()),flush=True)
