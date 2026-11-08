#!/usr/bin/env python3
"""Inspect real public dropdown option DOMs for seven school-custom search filters.
Never submit a school search or log in; only inspect filter drawers/options.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('public/zocbo-original-data')
out.mkdir(exist_ok=True)
url='https://m.zocbo.com/M/expected.asp'
actions=['filter_type','filter_si','filter_gu','filter_sch','filter_grade','filter_subject','filter_Chapter']
result={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=ctx.new_page()
 for action in actions:
  try:
   page.goto(url,wait_until='domcontentloaded',timeout=30000)
   page.wait_for_timeout(2200)
   button=page.locator(f'[data-src="expected"][data-act="{action}"]')
   if button.count()==0:
    result[action]={'error':'FILTER_MISSING'}
    continue
   initial=button.first.inner_text().strip()
   button.first.click(timeout=10000)
   page.wait_for_timeout(1000)
   info=page.evaluate("""() => {
      const layer=document.querySelector('#bottomSheetLayer')||document.querySelector('.bottomSheetLayer');
      const visible=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length};
      const options=[...document.querySelectorAll('#bottomSheetLayer li, #bottomSheetLayer button, #bottomSheetLayer a, .bottomSheetLayer li, .bottomSheetLayer button, .bottomSheetLayer a')]
        .filter(visible).map(e=>({label:(e.innerText||'').trim().slice(0,75),value:e.getAttribute('data-value')||e.getAttribute('value')||'',action:e.getAttribute('data-act')||'',tag:e.tagName})).filter(x=>x.label&&x.label.length<65);
      return {layerText:(layer?.innerText||'').slice(0,900),options:options.slice(0,200),layerVisible:!!layer&&visible(layer),pageText:(document.body?.innerText||'').slice(-500)};
   }""")
   result[action]={'initial':initial,**info}
   print('SCHOOL_OPTIONS',action,len(info.get('options',[])),info.get('layerVisible'),flush=True)
  except Exception as e:
   result[action]={'error':str(e)[:300]}
 ctx.close();browser.close()
(out/'school_filter_drawers.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print('SCHOOL_OPTIONS_CAPTURED',json.dumps({k:{'choices':len(v.get('options',[])),'error':v.get('error')} for k,v in result.items()},ensure_ascii=False),flush=True)
