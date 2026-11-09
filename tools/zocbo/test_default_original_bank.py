#!/usr/bin/env python3
"""End-to-end: HITEL HOME bottom '문제은행' opens original-source HTML sector by default.

The native HITEL bottom menu stays available, unlike full ?original=1 mode.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HITEL_BASE_URL','http://127.0.0.1:3000').rstrip('/')
OUT=Path('zocbo-default-bank-original-evidence');OUT.mkdir(exist_ok=True)
log={'base':BASE,'errors':[]}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=c.new_page();page.set_default_timeout(22000)
 page.on('pageerror',lambda e:log['errors'].append(str(e)[:230]))
 page.goto(BASE+'/?screen=home&mobile=1',wait_until='domcontentloaded',timeout=30000)
 btn=page.locator('#phone .bottomnav button').filter(has_text='문제은행')
 assert btn.count()==1,'home bottom problem bank missing'
 btn.click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=45000)
 assert page.locator('body.zb-original-sector').count()==1
 assert page.locator('#phone .zb-original-main-tabs .tabLineRound li').count()==6
 assert page.locator('#phone .zb-original-head').count()==1
 assert page.locator('#phone .bottomnav:visible').count()==1,'HITEL bottom bar lost in embedded sector'
 assert page.locator('#phone .zb-original-footer').count()==0,'full original footer should be exclusive to full clone mode'
 page.wait_for_function("()=>document.querySelectorAll('#phone [data-zb-paper-id]').length>=400",timeout=45000)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.screenshot(path=str(OUT/'home-bottom-bank-original-sector.png'),full_page=False)
 log['fromHome']={'bottomProblemBank':'works','originalTop':6,'originalPapers':page.locator('#phone [data-zb-paper-id]').count(),'hitelBottomStillVisible':True}
 # Independent direct URL for real middle3 English original menu and source data.
 page.goto(BASE+'/?screen=bankSearch&mobile=1&site=M&grade=3&subject=EG',wait_until='domcontentloaded',timeout=35000)
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=45000)
 page.wait_for_function("()=>document.querySelectorAll('#phone [data-zb-paper-id]').length===80",timeout=35000)
 assert page.locator('#phone .zb-original-sub-tabs .lnb__button.is-active').inner_text()=='본문 N제'
 assert page.locator('#phone .zb-original-filters .zbFilter__button').all_inner_texts()==['중3','영어','천재(이재영)']
 assert page.locator('#phone .bottomnav:visible').count()==1
 page.locator('#phone .zb-original-main-tabs [data-zb-main=practice]').click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_practice'",timeout=30000)
 page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=30000)
 page.screenshot(path=str(OUT/'default-original-middle3-english-practice.png'),full_page=False)
 assert page.locator('#phone iframe').count()==0
 log['english']={'title':'본문 N제','publicPapers':80,'practiceTab':'opens original source'}
 c.close();b.close()
(OUT/'report.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf8')
assert not log['errors'],log['errors']
print('HITEL_HOME_TO_DEFAULT_ORIGINAL_BANK_PASSED',json.dumps(log,ensure_ascii=False),flush=True)
