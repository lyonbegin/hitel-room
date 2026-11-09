#!/usr/bin/env python3
"""Exercise actual school-by-school original controls inside source chrome view.

Original school dropdown list requests are delegated to the real anonymous
/_api/community.api.asp (not hardcoded fake cities or schools).
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HITEL_BASE_URL','http://127.0.0.1:3000').rstrip('/')
OUT=Path('zocbo-school-original-evidence');OUT.mkdir(exist_ok=True)
log={'base':BASE,'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=ctx.new_page();page.set_default_timeout(25000)
 page.on('pageerror',lambda e:log['errors'].append(str(e)[:250]))
 page.goto(BASE+'/?screen=bankSearch&mobile=1&original=1&site=M&grade=3&subject=EG',wait_until='domcontentloaded',timeout=35000)
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=40000)
 page.locator('#phone .zb-original-main-tabs [data-zb-main=school]').click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.sourceCase==='M_3_EG_school'",timeout=30000)
 page.locator('#phone .zb-faithful[data-zb-chrome-ready="1"]').wait_for(timeout=30000)
 assert page.locator('#phone .zb-original-filters .select-btn[data-zb-filter]').count()==7
 # Pick original region.
 page.locator('#phone .zb-original-filters [data-zb-filter=filter_si]').click()
 page.get_by_role('dialog',name='시·도 선택').get_by_role('button',name='서울').click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=30000)
 assert not page.locator('#phone .zb-original-filters [data-zb-filter=filter_gu]').is_disabled()
 # Actual Seoul district list from original anonymous AJAX.
 page.locator('#phone .zb-original-filters [data-zb-filter=filter_gu]').click()
 districtDialog=page.get_by_role('dialog',name='시·군·구 선택')
 districtDialog.wait_for(timeout=30000)
 districtDialog.get_by_role('button',name='강남구').wait_for(timeout=30000)
 districtCount=districtDialog.locator('.zb-f-choices button').count()
 assert districtCount==26,('Original Seoul districts unexpected',districtCount)
 districtDialog.get_by_role('button',name='강남구').click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=30000)
 # The original official school's ID for Sookmyung Girls Middle is 6357.
 page.locator('#phone .zb-original-filters [data-zb-filter=filter_sch]').click()
 schoolDialog=page.get_by_role('dialog',name='학교 선택')
 schoolDialog.get_by_role('button',name='숙명여자중학교').wait_for(timeout=30000)
 schoolCount=schoolDialog.locator('.zb-f-choices button').count()
 assert schoolCount==25,('Original Gangnam schools unexpected',schoolCount)
 schoolDialog.get_by_role('button',name='숙명여자중학교').click()
 page.wait_for_function("()=>document.querySelector('#phone .zb-faithful')?.dataset.zbChromeReady==='1'",timeout=30000)
 label=page.locator('#phone .zb-original-filters').inner_text()
 assert '서울' in label and '강남구' in label and '숙명여자중학교' in label,label
 page.screenshot(path=str(OUT/'original-school-seoul-gangnam-sookmyung-390.png'),full_page=False)
 log.update({'schoolCase':'M_3_EG_school','originalRegion':'서울','districts':districtCount,
             'district':'강남구','schools':schoolCount,'school':'숙명여자중학교','originalSchoolID':'6357',
             'controls':7,'displayed':label})
 ctx.close();browser.close()
(OUT/'report.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf8')
assert not log['errors'],log['errors']
print('ORIGINAL_SCHOOL_FILTERS_PASSED',json.dumps(log,ensure_ascii=False),flush=True)
