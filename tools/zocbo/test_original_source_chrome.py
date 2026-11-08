#!/usr/bin/env python3
"""Original chrome sourced from actual original mobile HTML: real browser action test.

The old HITEL screen and original chrome screen can coexist. This test navigates
the source markup, not fake button names, including dynamic textbook AJAX search.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HITEL_BASE_URL','http://127.0.0.1:3000').rstrip('/')
OUT=Path('zocbo-original-chrome-evidence');OUT.mkdir(exist_ok=True)
results={'base':BASE,'widths':{},'errors':[]}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 for width in (390,360):
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,locale='ko-KR')
  page=c.new_page();page.set_default_timeout(20000)
  page.on('pageerror',lambda e:results['errors'].append(str(e)[:200]))
  url=BASE+'/?screen=bankSearch&mobile=1&original=1&site=M&grade=3&subject=EG'
  page.goto(url,wait_until='domcontentloaded',timeout=35000)
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_unit'",timeout=35000)
  page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=40000)
  assert page.locator('#phone .zb-original-head .zb-original-logo img').count()==1
  assert page.locator('#phone .zb-original-main-tabs .tabLineRound li').count()==6
  assert page.locator('#phone .zb-original-sub-tabs .lnb__button').count()==2
  assert page.locator('#phone .zb-original-filters .zbFilter__button').count()==3
  assert page.locator('#phone .zb-original-banner .hijeckingBanner').count()==1
  assert page.locator('#phone .zb-original-utility #MenuDescription button').count()==1
  assert page.locator('#phone .zb-original-footer >*').count()==5
  assert page.locator('#phone .osbar:visible').count()==0
  assert page.locator('#phone .appbar:visible').count()==0
  assert page.locator('#phone .bottomnav:visible').count()==0
  page.wait_for_function("()=>document.querySelectorAll('#phone [data-zb-paper-id]').length===80",timeout=40000)
  # Real original guide utility responds, does not contain a dead button.
  page.locator('#phone .zb-original-utility #MenuDescription button').click()
  page.get_by_role('dialog',name='이용 안내').wait_for(timeout=10000)
  page.locator('.zb-original-dialog [data-zb-close]').last.click()
  # Actual copied original top DOM tab transitions to real subject-specific source.
  page.locator('#phone .zb-original-main-tabs [data-zb-main="practice"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_practice'",timeout=25000)
  page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=20000)
  assert page.locator('#phone .zb-original-sub-tabs .lnb__button').count()>=4
  page.locator('#phone .zb-original-main-tabs [data-zb-main="unit"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_unit'",timeout=25000)
  page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=20000)
  # Original textbook button opens original-captured bottom sheet choices.
  page.locator('#phone .zb-original-filters [data-zb-filter="SEARCH_TX_CD"]').click()
  sheet=page.get_by_role('dialog',name='교과서 선택');sheet.wait_for(timeout=20000)
  sheet.get_by_role('button',name='미래엔(최연희)').click()
  page.wait_for_function("()=>window.ZOCBO_FAITHFUL_INSPECT()?.current?.fDynamicData?.total===70",timeout=35000)
  page.screenshot(path=str(OUT/f'actual-original-dom-after-textbook-{width}.png'),full_page=False)
  # Footer actually changes school, matching real source site.
  page.locator('#phone .zb-original-footer button[data-zb-site="H"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='H_1_MT_unit'",timeout=35000)
  page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=20000)
  page.wait_for_function("()=>document.querySelectorAll('#phone [data-zb-paper-id]').length>=400",timeout=35000)
  assert page.locator('#phone iframe').count()==0
  width_docs=page.evaluate('document.documentElement.scrollWidth')
  assert width_docs<=width,(width,width_docs)
  page.screenshot(path=str(OUT/f'actual-original-dom-high1-{width}.png'),full_page=False)
  results['widths'][str(width)]={'sourceTopTabs':6,'sourceSubTabs':2,'sourceTextbookChoices':8,
       'sourceOriginalEnglishPapers':80,'originalSecondTextbookPapers':70,
       'high1PublicPapers':page.locator('#phone [data-zb-paper-id]').count(),
       'viewportWidth':width,'documentWidth':width_docs,'guideOpens':True,'originalFooterWorks':True}
  c.close()
 b.close()
(OUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
assert not results['errors'],results['errors']
print('ACTUAL_ORIGINAL_CHROME_DOM_E2E_PASSED',json.dumps(results,ensure_ascii=False),flush=True)
