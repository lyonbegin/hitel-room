#!/usr/bin/env python3
"""Cross-school/subject verified source matrix for HITEL faithful mobile sector.

All labels and counts below were measured from original m.zocbo.com Chromium DOM,
not guessed from previous HITEL screenshots or maths tabs.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HITEL_BASE_URL','http://127.0.0.1:3000').rstrip('/')
OUT=Path('zocbo-source-matrix-evidence');OUT.mkdir(exist_ok=True)
CASES=[
 ('M','1','SC','수준별 학습',['중1','과학','공통','기본'],181),
 ('M','2','MT','수준별 학습',['중2','수학','공통','기본'],383),
 ('M','3','EG','본문 N제',['중3','영어','천재(이재영)'],80),
 ('M','3','KR','단원 집중',['중3','국어','미래엔(신유식)','중단원 학습'],150),
 ('H','1','MT','수준별 학습',['고1','공통수학','공통','기본'],411),
 ('H','2','EG','본문 N제',['고2·3','영어','영어Ⅰ','능률(오선영)'],50)
]
result={'base':BASE,'cases':[],'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=ctx.new_page()
 page.set_default_timeout(20000)
 page.on('pageerror',lambda e:result['errors'].append(str(e)[:240]))
 for site,grade,subject,active,filters,originalCount in CASES:
  url=BASE+f'/?screen=bankSearch&mobile=1&site={site}&grade={grade}&subject={subject}'
  page.goto(url,wait_until='domcontentloaded',timeout=35000)
  expected=f'{site}_{grade}_{subject}_unit'
  page.wait_for_function("(name)=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase===name",expected,timeout=40000)
  page.wait_for_function("(count)=>document.querySelectorAll('#phone [data-zb-paper-id]').length>=count",originalCount,timeout=45000)
  sub=page.locator('#phone .zb-f-subtabs button.is-active').inner_text()
  vals=page.locator('#phone .zb-f-filter-item span').all_inner_texts()
  assert sub==active,(expected,'sub mismatch',sub,active)
  assert vals==filters,(expected,'filter mismatch',vals,filters)
  total=page.locator('#phone [data-zb-paper-id]').count()
  assert total>=originalCount,(expected,'paper counts',total,originalCount)
  assert page.locator('#phone .zb-f-main-tabs button').count()==6
  assert page.locator('#phone iframe').count()==0
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  box=page.locator('#phone').bounding_box()
  assert box and abs(box['width']-390)<2,(expected,box)
  page.screenshot(path=str(OUT/f'{site}{grade}-{subject}-actual-menu.png'),full_page=False)
  result['cases'].append({'case':expected,'active':sub,'filters':vals,'papers':total,
    'matchedOriginalCount':originalCount,'standaloneWidth':box['width']})
 # Check main-tab interactions and original source fragment change, not static tab labels.
 page.goto(BASE+'/?screen=bankSearch&mobile=1&site=M&grade=3&subject=EG',wait_until='domcontentloaded',timeout=35000)
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_unit'",timeout=35000)
 expectedMeta={'concept':'M_3_EG_concept','practice':'M_3_EG_practice',
               'revision':'M_3_EG_revision','school':'M_3_EG_school','gangnam':'M_3_EG_gangnam'}
 for main,target in expectedMeta.items():
  page.locator(f'#phone [data-action="zbFMain"][data-value="{main}"]').click()
  page.wait_for_function("(name)=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase===name",target,timeout=35000)
  assert page.locator('#phone .zb-f-main-tabs button.is-active').count()==1
  result.setdefault('topNavigation',[]).append({'tab':main,'case':target})
 ctx.close();browser.close()
(OUT/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
assert not result['errors'],result['errors']
print('ORIGINAL_SIX_GRADE_SUBJECTS_AND_TABS_PASSED',json.dumps(result,ensure_ascii=False)[:5000],flush=True)
