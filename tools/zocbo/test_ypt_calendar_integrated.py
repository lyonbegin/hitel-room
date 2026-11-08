#!/usr/bin/env python3
"""Browser regression on existing YPT calendar host and Zocbo inner content."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('HITEL_BASE_URL','https://hitel-education-zocbo-unified-production.up.railway.app').rstrip('/')
OUT=Path('ypt-zocbo-integration-evidence');OUT.mkdir(exist_ok=True)
REPORT={'base':BASE,'screens':[],'pageErrors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (360,390):
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,locale='ko-KR')
  page=context.new_page();page.set_default_timeout(40000)
  page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
  page.goto(BASE+'/?screen=calendar',wait_until='domcontentloaded',timeout=60000)
  page.locator('#phone .bottomnav button').filter(has_text='족보').wait_for()
  assert page.locator('#phone .bottomnav').count()==1
  assert page.locator('#phone .zb-faithful').count()==0,'Calendar must not render bank content'
  assert page.locator('#phone .bottomnav button').count()==4,'Four HITEL study-group tabs must be preserved'
  page.screenshot(path=str(OUT/f'{width}-calendar-before.png'),full_page=False)
  page.locator('#phone .bottomnav button').filter(has_text='족보').click()
  page.locator('#phone .zb-faithful .zb-f-main-tabs button').first.wait_for(timeout=50000)
  assert page.locator('#phone .bottomnav').count()==1,'Exactly one existing YPT nav'
  assert page.locator('#phone .zb-original-footer').count()==0,'No Zocbo standalone bottom nav'
  assert page.locator('#phone .zb-f-main-tabs button').count()==6
  assert page.locator('#phone iframe').count()==0
  assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth+2"),'Mobile horizontal overflow'
  page.screenshot(path=str(OUT/f'{width}-bank.png'),full_page=False)
  page.locator('#phone [data-action="zbFMain"][data-value="gangnam"]').click()
  page.locator('#phone .zb-f-districts button').first.wait_for(timeout=45000)
  page.locator('#phone .zb-f-gangnam-papers button').first.wait_for(timeout=45000)
  assert page.locator('#phone .zb-f-gangnam-papers button').count()==20
  check={'width':width,'districts':[]}
  for district in ('강남구','서초구','송파구'):
   page.locator(f'#phone [data-action="zbFGangnamDistrict"][data-value="{district}"]').click()
   page.wait_for_function("(x)=>{const a=document.querySelector('#phone .zb-f-district-schools');return a && a.textContent.includes(x) && !a.textContent.includes('조회 중입니다')}",arg=district,timeout=45000)
   school_count=page.locator('#phone .zb-f-school-list button').count()
   err=page.locator('#phone .zb-f-district-schools [role=alert]').all_inner_texts()
   assert school_count>0,(district,err)
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),district
   check['districts'].append({'name':district,'schools':school_count,'errors':err})
   page.screenshot(path=str(OUT/f'{width}-{district}.png'),full_page=False)
  page.locator('#phone .zb-f-gangnam-papers button').first.click()
  assert page.locator('#phone .zb-f-gangnam-detail').count()==1
  page.locator('#phone [data-action="zbFGangnamClose"]').click()
  assert page.locator('#phone .zb-f-gangnam-detail').count()==0
  page.locator('#phone .bottomnav button').filter(has_text='스터디그룹').click()
  page.locator('#phone [data-wp="chooseGroup"][data-value="my-study"]').first.click()
  page.locator('#phone [data-go="calendar"]').first.click()
  assert page.locator('#phone .zb-faithful').count()==0
  assert page.locator('#phone .bottomnav button').count()==4
  assert 'screen=calendar' in page.url
  check['returnedToCalendar']=True
  REPORT['screens'].append(check)
  page.screenshot(path=str(OUT/f'{width}-calendar-after.png'),full_page=False)
  context.close()
 browser.close()
(OUT/'result.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf8')
assert not REPORT['pageErrors'],REPORT['pageErrors']
print('YPT_CALENDAR_WITH_ZOCBO_INTEGRATION_PASSED',json.dumps(REPORT,ensure_ascii=False),flush=True)
