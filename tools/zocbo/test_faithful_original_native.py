#!/usr/bin/env python3
"""Real Chromium regression for 700-source native mobile HITEL sector, not iframe/mock.

Middle 3 English original: active '본문 N제', textbook '천재(이재영)', 80 paper ID buttons.
Changing grade & subject is real interaction. Changing textbook invokes recorded
original AJAX template and does not silently retain the old 80 results.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HITEL_BASE_URL','http://127.0.0.1:3000').rstrip('/')
OUT=Path('zocbo-faithful-evidence');OUT.mkdir(exist_ok=True)
report={'base':BASE,'widths':{},'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (390,360):
  ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,locale='ko-KR')
  page=ctx.new_page()
  page.set_default_timeout(18000)
  page.on('pageerror',lambda e:report['errors'].append({'width':width,'error':str(e)[:320]}))
  page.goto(BASE+'/?screen=bankSearch',wait_until='domcontentloaded',timeout=35000)
  page.wait_for_function("()=>window.ZOCBO_FAITHFUL_INSPECT?.().source?.cases===700",timeout=40000)
  page.wait_for_selector('#phone .zb-faithful[data-source-case]',timeout=30000)
  # Original six top categories, not a partial hardcoded 4-category demo.
  assert page.locator('#phone .zb-f-main-tabs button').count()==6
  assert page.locator('#phone iframe').count()==0
  # Switch high to middle, grade to year three, then subject English using ORIGINAL choice sheet.
  page.locator('#phone [data-action="zbFSite"][data-value="M"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_2_MT_unit'",timeout=25000)
  page.locator('#phone [data-action="zbFFilter"][data-value="SEARCH_GRADE"]').click()
  page.get_by_role('dialog',name='학년 선택').wait_for()
  page.get_by_role('dialog',name='학년 선택').get_by_role('button',name='중3').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_MT_unit'",timeout=25000)
  page.locator('#phone [data-action="zbFFilter"][data-value="SEARCH_SUBJECT_CD"]').click()
  page.get_by_role('dialog',name='과목 선택').get_by_role('button',name='영어').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_unit'",timeout=25000)
  page.wait_for_function("()=>document.querySelectorAll('#phone .zb-faithful [data-zb-paper-id]').length===80",timeout=30000)
  subtabs=page.locator('#phone .zb-f-subtabs button').all_inner_texts()
  filters=page.locator('#phone .zb-f-filter-item span').all_inner_texts()
  assert subtabs==['본문 N제','수학 MASTER'],subtabs
  assert filters==['중3','영어','천재(이재영)'],filters
  assert page.locator('#phone .zb-f-subtabs button.is-active').inner_text()=='본문 N제'
  page.screenshot(path=str(OUT/f'middle3-english-true-original-{width}.png'),full_page=False)
  # Accordion: use original source nested DOM, not built-in generic title list.
  root=page.locator('#phone #ROOT_PART_CD > .zbAccordion__item').first
  root.locator(':scope > .zbAccordion__header > button').click()
  assert 'zb-f-open' in (root.get_attribute('class') or '')
  nested=root.locator('.zbAccordion__item').first
  if nested.count(): nested.locator(':scope > .zbAccordion__header > button').click()
  page.screenshot(path=str(OUT/f'english-accordion-open-{width}.png'),full_page=False)
  paper=page.locator('#phone [data-zb-paper-id]').first
  real_id=paper.get_attribute('data-zb-paper-id')
  assert real_id=='15065610',real_id
  paper.click(force=True)
  dialog=page.get_by_role('dialog',name='원본 자료 상세')
  dialog.wait_for()
  assert real_id in dialog.inner_text()
  page.locator('#phone [data-action="zbFClose"]').last.click()
  # Source actual top concept changes subject-specific sub tabs.
  page.locator('#phone [data-action="zbFMain"][data-value="concept"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_concept'",timeout=25000)
  assert '영문법' in page.locator('#phone .zb-f-subtabs').inner_text()
  assert page.locator('#phone [data-zb-paper-id]').count()>=72
  # Return to original exact English unit and click original textbook choice.
  page.locator('#phone [data-action="zbFMain"][data-value="unit"]').click()
  page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_unit'",timeout=25000)
  page.locator('#phone [data-action="zbFFilter"][data-value="SEARCH_TX_CD"]').click()
  sheet=page.get_by_role('dialog',name='교과서 선택')
  sheet.wait_for()
  assert sheet.get_by_role('button',name='미래엔(최연희)').count()==1
  sheet.get_by_role('button',name='미래엔(최연희)').click()
  page.wait_for_function("()=>!document.querySelector('#phone .zb-f-loading')",timeout=35000)
  assert '미래엔(최연희)' in page.locator('#phone .zb-f-filter').inner_text()
  # Changed textbook must never display stale 천재 dataset as though it were refreshed.
  st=page.evaluate('window.ZOCBO_FAITHFUL_INSPECT().current')
  assert st.get('fDynamicData') or st.get('fDynamicError'),st
  if st.get('fDynamicData'):
   assert st['fDynamicData'].get('source')=='verified-anonymous-original-ajax'
   assert st['fDynamicData'].get('filter')=='SEARCH_TX_CD'
  report['widths'][str(width)]={'sixTopTabs':True,'subTabs':subtabs,'filters':filters,
     'originalPaperID':real_id,'originalDocs':80,
     'changedTextbookStatus':'real-original-query' if st.get('fDynamicData') else 'explicit-original-query-error',
     'changedTextbookTotal':st.get('fDynamicData',{}).get('total'),
     'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>window.innerWidth')}
  assert not report['widths'][str(width)]['horizontalOverflow']
  ctx.close()
 browser.close()
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
assert not report['errors'],report['errors']
print('FAITHFUL_ORIGINAL_MOBILE_BROWSER_PASSED',json.dumps(report,ensure_ascii=False)[:3800],flush=True)
