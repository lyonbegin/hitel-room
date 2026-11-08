#!/usr/bin/env python3
"""Capture *public* browser-rendered original mobile chapter menus into reproducible metadata.
No authentication, download, checkout, protected paths or interaction beyond menu navigation.
"""
import json,re,time
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

OUT=Path("public/zocbo-original-data")
OUT.mkdir(parents=True,exist_ok=True)
MODES={
 'concept_complete':'000010000100001',
 'concept_calculation':'000010000100004',
 'unit_level':'000010000200003',
 'unit_master':'000010000200002',
 'practice_essay':'000010000300001',
 'practice_frequent':'000010000300002',
 'practice_wrong':'000010000300003',
 'practice_top':'000010000300004',
 'practice_performance':'000010000300009',
 'practice_textbook':'000010000300008',
 'final_main':'000010000400001',
}
def parse_doc(html):
 soup=BeautifulSoup(html,'html.parser')
 root=soup.select_one('#ROOT_PART_CD')
 chapters=[];total=0
 if root:
  for c in root.find_all('div',class_='zbAccordion__item',recursive=False):
   h=c.find('div',class_='zbAccordion__header',recursive=False)
   if not h or not h.button:continue
   cr={'name':h.button.get_text(' ',strip=True),'subs':[]}
   for sub in c.select('.zbAccordion__item'):
    hs=sub.find('div',class_='zbAccordion__header',recursive=False)
    if not hs or not hs.button:continue
    sr={'name':hs.button.get_text(' ',strip=True),'details':[]}
    for block in sub.select('.download'):
     group=block.select_one('.grouping__title')
     if not group:continue
     detail={'name':group.get_text(' ',strip=True),'tags':[x.get_text(' ',strip=True) for x in block.select('.download__badge span')],'items':[]}
     for button in block.select('button[onclick]'):
      call=button.get('onclick','')
      kind='video' if 'goDownLayer' in call else 'exam' if 'goExpaprLayer' in call else 'other'
      if kind=='other':continue
      ids=re.findall(r'\b\d{5,}\b',call)
      record={'id':ids[0] if ids else '', 'name':button.get_text(' ',strip=True),'kind':kind,
       'videoId':ids[-1] if kind=='video' and ids else '', 'sourceAction':call[:200]}
      if record['id']:detail['items'].append(record);total+=1
     if detail['items']:sr['details'].append(detail)
    if sr['details']:cr['subs'].append(sr)
   if cr['subs']:chapters.append(cr)
 return {'chapters':chapters,'items':total}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1,locale='ko-KR')
 page=context.new_page()
 report={}
 for slug,menu in MODES.items():
  url='https://m.zocbo.com/exam/examListWeb.asp?menu_cd='+menu+'&siteid=M&subject_cd=MT'
  row={'slug':slug,'menu':menu,'requested':url}
  try:
   res=page.goto(url,wait_until='domcontentloaded',timeout=30000)
   page.wait_for_timeout(2400)
   try:page.locator('#examMain .zbAccordion__item').first.wait_for(timeout=9000)
   except:pass
   doc=page.locator('body').inner_html(timeout=10000)
   parsed=parse_doc(doc)
   actual=page.evaluate("""() => ({
      url:location.href,submenus:[...document.querySelectorAll('#lnb_main_web button')].map(x=>({label:x.innerText.trim(),action:x.getAttribute('onclick')})),
      filters:[...document.querySelectorAll('#filter button')].map(x=>x.innerText.trim()),
      visibleText:(document.querySelector('#examMain')?.innerText||'').trim().length
   })""")
   row.update({'http':res.status if res else 0,**actual,**parsed})
  except Exception as e:row['error']=str(e)[:300]
  report[slug]={'http':row.get('http'),'chapters':len(row.get('chapters',[])),'records':row.get('items',0),'error':row.get('error')}
  (OUT/(slug+'.json')).write_text(json.dumps(row,ensure_ascii=False,separators=(',',':')),encoding='utf8')
  print('ORIGINAL_MODE',slug,report[slug],flush=True)
 # Capture separate school-specific filters and Gangnam-list public records.
 for slug,url in {
  'school_expected':'https://m.zocbo.com/M/expected.asp',
  'gangnam_list':'https://m.zocbo.com/M/?menu=2&type=4',
 }.items():
  row={'slug':slug,'requested':url}
  try:
   result=page.goto(url,wait_until='domcontentloaded',timeout=30000)
   page.wait_for_timeout(3500)
   row.update(page.evaluate("""() => ({
     actualUrl:location.href,
     filters:[...document.querySelectorAll('#filter button,#filter_2 button')].filter(x=>getComputedStyle(x).display!=='none').map(x=>({name:x.innerText.trim(),action:x.dataset.act,source:x.dataset.src,value:x.value||''})),
     total:document.querySelector('#recordCount')?.innerText||'',
     records:[...document.querySelectorAll('#list_A li[data-no]')].map(x=>({
       id:x.dataset.no||'',title:x.dataset.title||'',site:x.dataset.siteid||'',grade:x.dataset.grade||'',subject:x.dataset.subjcode||'',
       group:x.dataset.group||'',tx:x.dataset.tx||'',year:x.dataset.year||'',
       tags:[...x.querySelectorAll('.tag span')].map(y=>y.innerText.trim())
     }))
   })"""))
   row['http']=result.status if result else 0
  except Exception as exc:row['error']=str(exc)[:250]
  (OUT/(slug+'.json')).write_text(json.dumps(row,ensure_ascii=False,separators=(',',':')),encoding='utf8')
  report[slug]={'http':row.get('http'),'records':len(row.get('records',[])),'filters':len(row.get('filters',[])),'error':row.get('error')}
  print('ORIGINAL_MODE',slug,report[slug],flush=True)
 context.close();browser.close()
(OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('SOURCE_MODES_COMPLETE',json.dumps(report,ensure_ascii=False),flush=True)
