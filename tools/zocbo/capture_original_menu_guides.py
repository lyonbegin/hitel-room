#!/usr/bin/env python3
"""Click original mobile '이용 안내' menu for all six menus, retain public sheet HTML.
No login, payment, media download or state mutation, only read-only UI controls.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
OUT=Path('public/zocbo-original-guides');OUT.mkdir(parents=True,exist_ok=True)
ROOT='https://m.zocbo.com'
cases={
 'concept':'/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=EG&grade=3',
 'unit':'/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=EG&grade=3',
 'practice':'/exam/examListWeb.asp?menu_cd=000010000300001&siteid=M&subject_cd=EG&grade=3',
 'revision':'/exam/examListWeb.asp?menu_cd=000010000400001&siteid=M&subject_cd=EG&grade=3',
 'school':'/M/expected.asp',
 'gangnam':'/M/?menu=2&type=4',
 'high-unit':'/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=EG&grade=2'
}
results={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=c.new_page()
 for name,route in cases.items():
  record={'requested':ROOT+route,'mode':name}
  try:
   r=page.goto(record['requested'],wait_until='domcontentloaded',timeout=30000)
   page.wait_for_timeout(1700)
   button=page.locator('#MenuDescription button').first
   record['buttonFound']=button.count()>0 and button.is_visible()
   if record['buttonFound']:
    button.click(timeout=10000)
    page.wait_for_timeout(1000)
    sheet=page.evaluate("""() => {
      const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
      const xs=[...document.querySelectorAll('#bottomSheetLayer,.bottomSheet,.modal,.popLayer,[role=dialog]')].filter(visible);
      const matched=xs.find(x=>x.innerText.includes('이용')&&x.innerText.length>80)||xs[0];
      return {visible:!!matched,html:matched?.outerHTML?.slice(0,95000)||'',text:matched?.innerText?.slice(0,5000)||'',selector:matched?.className||matched?.id||'',
      url:location.href};
    }""")
    record.update(sheet)
   record['status']=r.status if r else None
  except Exception as e:record['error']=str(e)[:350]
  results[name]={k:v for k,v in record.items() if k!='html'}
  (OUT/(name+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
  print('SOURCE_GUIDE',name,record.get('buttonFound'),record.get('visible'),len(record.get('html','')),record.get('error',''),flush=True)
 c.close();b.close()
(OUT/'audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print('ORIGINAL_GUIDES_CAPTURED',len(results),flush=True)
