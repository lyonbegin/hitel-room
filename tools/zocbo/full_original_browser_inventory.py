#!/usr/bin/env python3
"""Inventory of REAL original mobile navigation and client assets via GitHub Actions Chromium.

Read-only anonymous inspection. Never log in, pay, download study files or modify the source.
Unlike the 2026-11-08 implementation, discover menu structure PER site, grade, subject.
Save independent evidence of site grade, subject, actual top/sub-menu labels,
original rendered DOM, UI filter options, source JS/CSS URLs and public AJAX responses.
"""
import argparse, hashlib, json, re, time, traceback
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

P=argparse.ArgumentParser()
P.add_argument('--phase',choices=['discovery','matrix'],default='discovery')
P.add_argument('--shard',type=int,default=0)
P.add_argument('--shards',type=int,default=1)
P.add_argument('--limit',type=int,default=0)
P.add_argument('--site',choices=['M','H'],default=None)
P.add_argument('--grade',choices=['1','2','3'],default=None)
A=P.parse_args()
BASE='https://m.zocbo.com'
OUT=Path('zocbo-original-inventory') / A.phase / str(A.shard)
OUT.mkdir(parents=True,exist_ok=True)
ROOT=Path('zocbo-original-inventory')
ORIGINAL_PUBLIC_AJAX=('/exam/ajax/','/_api/community.api.asp')
SUBJECT_CODE_RE=re.compile(r"^[A-Z0-9]{2,8}$")
TOP_MENU_CODES=[
 ('concept','000010000100001'),('unit','000010000200003'),
 ('practice','000010000300001'),('revision','000010000400001'),
 ('school','expected'),('gangnam','gangnam')]
DEFAULT_SUBJECTS={'MT':'수학','EG':'영어','KR':'국어','SC':'과학'}
URL_SEEDS=[
 ('M','2','MT'),('M','3','EG'),('M','3','MT'),
 ('M','2','EG'),('M','2','KR'),('M','1','SC'),
 ('H','1','MT'),('H','2','EG'),('H','3','MT')]
JS_CAPTURE_MAX=1000000
HTML_MAX=2500000
NET_CAPTURE_MAX=350000
manifest={"scope":"anonymous read-only original mobile, no private or authenticated resources","phase":A.phase,"shard":A.shard,"cases":[],"discoveredResources":{},"errors":[]}
asset_data={}
requests=[]
current=None

def safe(s,n=300):return str(s or '')[:n]
def basename(s):
 return re.sub(r'[^a-zA-Z0-9._-]+','_',s)[:90]
def write_json(name,obj):
 path=OUT/name
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf8')
def mode_url(site,grade,subj,mode):
 if mode=='expected':
  return f'{BASE}/{site}/expected.asp'
 if mode=='gangnam':
  return f'{BASE}/{site}/?menu=2&type=4'
 menu=('00002'+mode[5:]) if site=='H' else mode
 return f'{BASE}/exam/examListWeb.asp?menu_cd={menu}&siteid={site}&subject_cd={subj}&grade={grade}'
def is_source(url):
 return urlparse(url).hostname in ('m.zocbo.com','sign.zocbo.com')
def sanitize_resource(url):
 u=urlparse(url)
 if u.hostname!='m.zocbo.com':return None
 # Avoid arbitrary query token/identity leakage: preserve only named known public params.
 return u.path+(('?'+u.query[:180]) if not re.search('token|key|auth|session',u.query,re.I) else '')
def on_response(response):
 global current
 u=response.url; pu=urlparse(u)
 if pu.hostname!='m.zocbo.com':return
 typ=(response.headers.get('content-type','') or '').lower()
 kind='js' if re.search(r'\.(js|mjs)(\?|$)',u,re.I) else 'css' if re.search(r'\.css(\?|$)',u,re.I) else 'image' if typ.startswith('image/') else 'xhr' if any(x in pu.path.lower() for x in ('/exam/ajax/','/_api/community.api.asp')) else 'document' if typ.startswith('text/html') else 'other'
 address=sanitize_resource(u)
 if address:
  manifest["discoveredResources"].setdefault(address,{"type":kind,"status":response.status,"contentType":typ[:90],"screens":[]})
  ids=manifest["discoveredResources"][address]["screens"]
  if current and len(ids)<20 and current not in ids:ids.append(current)
 if kind=='xhr' and current:
  item={"screen":current,"path":pu.path,"status":response.status,"method":response.request.method,"resourceType":response.request.resource_type}
  # Original AJAX request payload has only anonymous public filters. Whitelist query keys and never store cookie/header.
  d=response.request.post_data or ''
  if len(d)<1300 and not re.search(r'(password|passwd|token|session|secret|credential|jwt|mail|phone)=',d,re.I):
   item['publicFilterForm']=d[:1100]
  try:
   raw=response.body()
   if len(raw)<NET_CAPTURE_MAX and 'json' in typ or ('json' in typ and len(raw)<NET_CAPTURE_MAX):
    dest=hashlib.sha256((u+item.get('publicFilterForm','')).encode()).hexdigest()[:18]+'.json'
    (OUT/'ajax').mkdir(exist_ok=True)
    (OUT/'ajax'/dest).write_bytes(raw)
    item['responseFile']='ajax/'+dest
    item['bodyBytes']=len(raw)
  except Exception as e:item['error']=safe(e,130)
  requests.append(item)
 if kind in ('js','css') and address and len(asset_data)<220:
  # Archive only public static source assets, never student files / credentials.
  if pu.path not in asset_data:
   try:
    body=response.body()
    if 0<len(body)<=JS_CAPTURE_MAX:
     sha=hashlib.sha256(body).hexdigest()[:22]
     ext='.js' if kind=='js' else '.css'
     fn=f'{sha}{ext}'
     (OUT/'assets').mkdir(exist_ok=True)
     (OUT/'assets'/fn).write_bytes(body)
     asset_data[pu.path]={'file':'assets/'+fn,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'url':address}
   except Exception:pass

SNAP_JS=r"""() => {
 const visible=e=>{try{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}catch{return false}};
 const top=[...document.querySelectorAll('.tabLine-round_M li, .tabLine-round_H li, .tabLineRound li')].filter(visible)
 .map(li=>({name:(li.innerText||'').trim().replace(/\s+/g,' ').slice(0,90),
   active:li.classList.contains('active'),href:li.querySelector('a')?.href||'',source:li.dataset.src||'',
   code:li.dataset.mn||''})).filter(x=>x.name);
 const sub=[...document.querySelectorAll('#lnb_main_web button')].map(e=>({
   name:e.innerText.trim(),active:e.classList.contains('is-active'),onclick:e.getAttribute('onclick')||'',class:e.className}));
 const inputs=[...document.querySelectorAll('#filter button, #filter_1 button, #filter_2 button, #filter_3 button, .zbFilter__item button')]
 .filter(visible).map(x=>({name:x.innerText.trim().replace(/\s+/g,' ').slice(0,75),class:x.className,
    onclick:x.getAttribute('onclick')||'',action:x.dataset.act||'',source:x.dataset.src||'',value:x.value||'',
    disabled:!!x.disabled}));
 const rows=[...document.querySelectorAll('#list_A >li[data-no]')].slice(0,100)
 .map(e=>({id:e.dataset.no||'',title:e.dataset.title||'',grade:e.dataset.grade||'',subject:e.dataset.subjcode||''}));
 const exam=document.querySelector('#examMain');
 const episodeBtns=[...document.querySelectorAll('#examMain button.download__button')];
 const links=[...document.querySelectorAll('a[href]')].filter(visible).map(a=>({
    text:(a.innerText||'').trim().slice(0,65),href:a.href})).filter(a=>a.text&&!a.href.startsWith('javascript:')).slice(0,110);
 return {
  title:document.title,actualUrl:location.href,
  topMenus:top,subMenus:sub,filters:inputs,
  expectedRecords:document.querySelector('#recordCount')?.textContent?.trim()||null,
  rows:rows,rowsDOMCount:document.querySelectorAll('#list_A >li[data-no]').length,
  examSections:exam?.querySelectorAll(':scope >.zbAccordion >.zbAccordion__item').length||0,
  episodes:episodeBtns.length,firstEpisodes:episodeBtns.slice(0,3).map(x=>({label:x.innerText.trim(),handler:x.getAttribute('onclick')})),
  examTextChars:exam?.innerText?.trim().length||0,
  documentTextChars:document.body?.innerText?.trim().length||0,
  allSelectedTexts:[...document.querySelectorAll('button.is-active,.active a')].filter(visible).map(e=>e.innerText.trim()).filter(Boolean).slice(0,50),
  mainHTMLLength:document.querySelector('#section')?.outerHTML.length||0,
  htmlWidth:document.documentElement.scrollWidth,viewport:innerWidth,
  sourceScripts:[...document.scripts].map(x=>x.src).filter(Boolean),
  sourceCss:[...document.querySelectorAll('link[rel=stylesheet]')].map(x=>x.href)
 };
}"""
MODAL_JS=r"""() => {
 const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
 const items=[...document.querySelectorAll('body a,body button,body li,body input[type=radio],body label')].filter(vis)
  .map(e=>({text:(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80),
   value:e.getAttribute('data-value')||e.getAttribute('value')||'',class:e.className||'',
   handler:e.getAttribute('onclick')||'',tag:e.tagName}))
  .filter(x=>x.text&&x.text.length<75).slice(-200);
 return {visibleOptions:items,modalCandidates:[...document.querySelectorAll('[id*=Sheet],[class*=sheet],[class*=Sheet],[role=dialog]')].filter(vis).map(x=>({tag:x.tagName,id:x.id,classes:x.className,html:x.outerHTML.slice(0,16000),text:x.innerText.slice(0,1200)})).slice(0,5),
  tail:(document.body?.innerText||'').slice(-1700)}
}"""
def visit(page,ident,url,do_filters=False,screenshot=False):
 global current
 current=ident
 result={'id':ident,'requested':url,'visitedAtUnix':round(time.time())}
 try:
  response=page.goto(url,wait_until='domcontentloaded',timeout=25000)
  page.wait_for_timeout(1600)
  result['http']=response.status if response else None
  result['snapshot']=page.evaluate(SNAP_JS)
  snap=result['snapshot']
  key=basename(ident)
  (OUT/'dom').mkdir(exist_ok=True)
  html=page.content().encode('utf8')
  path=OUT/'dom'/(key+'.html')
  if len(html)<HTML_MAX:path.write_bytes(html);result['domFile']='dom/'+key+'.html'
  else:result['domTruncatedBytes']=len(html)
  if screenshot:
   (OUT/'screens').mkdir(exist_ok=True)
   page.screenshot(path=str(OUT/'screens'/(key+'.png')),full_page=False,timeout=10000)
   result['screenFile']='screens/'+key+'.png'
  if do_filters:
   result['filterInteractions']=[]
   for filt in snap.get('filters',[]):
    selector=None
    name=filt['name']
    if filt['onclick'] and "getBottomSheetLayer" in filt['onclick']:
     name_class=re.search(r"getBottomSheetLayer\('([^']+)'",filt['onclick'])
     if name_class:selector=f'#filter button.{name_class.group(1)}, .zbFilter button.{name_class.group(1)}'
    if not selector and filt['action']:
     selector=f'button[data-act="{filt["action"]}"]'
    if not selector:continue
    attempt={'filter':filt,'selector':selector}
    try:
     el=page.locator(selector).first
     if el.count() and el.is_enabled() and el.is_visible():
      el.click(timeout=3500)
      page.wait_for_timeout(350)
      attempt['afterClick']=page.evaluate(MODAL_JS)
      # Keep dialog DOM as evidence, but avoid storing full site DOM for each option.
      path=OUT/'options'
      path.mkdir(exist_ok=True)
      fname=key+'_'+basename(filt['name'])+'.json'
      (path/fname).write_text(json.dumps(attempt['afterClick'],ensure_ascii=False,indent=2),encoding='utf8')
      attempt['file']='options/'+fname
      page.keyboard.press('Escape')
      page.wait_for_timeout(150)
     else:attempt['result']='missing-disabled-hidden'
    except Exception as e:attempt['error']=safe(e,220)
    result['filterInteractions'].append({k:v for k,v in attempt.items() if k!='afterClick'})
  manifest['cases'].append(result)
  print('VISITED',ident,'http',result.get('http'),'top',len(snap.get('topMenus',[])),'sub',len(snap.get('subMenus',[])),
    'filters',len(snap.get('filters',[])),'episodes',snap.get('episodes'),'source',snap.get('actualUrl'),flush=True)
 except Exception as e:
  result['error']=safe(e,400);manifest['cases'].append(result)
  print('FAILED',ident,repr(e)[:200],flush=True)
 return result

def discover(page):
 # 1) Capture all real six top-menu paths for middle/high.
 for site in ('M','H'):
  for label,code in TOP_MENU_CODES:
   grade='2'
   url=mode_url(site,grade,'MT',code)
   visit(page,f'discover_{site}_{label}_math',url,do_filters=label in ('unit','school'),screenshot=True)
 # 2) Distinguish subject-dependent submenus and filters; exact screenshot bug reproduction.
 for site,grade,subj in URL_SEEDS:
  for label,code in TOP_MENU_CODES[:4]:
   url=mode_url(site,grade,subj,code)
   visit(page,f'seed_{site}_{grade}_{subj}_{label}',url,do_filters=(label=='unit' and subj=='EG'),screenshot=label=='unit')
 # 3) capture real subject bottom-sheet options for mid school maths and english.
 for site,grade,subject in (('M','3','EG'),('M','2','MT'),('H','1','MT')):
  url=mode_url(site,grade,subject,'000010000200003')
  visit(page,f'selector_{site}_{grade}_{subject}',url,do_filters=True,screenshot=True)

def subject_catalog(page,site,grade):
 """Derive real subject options from original public filter AJAX, not hard-coded subject list."""
 menu=('00002' if site=='H' else '00001')+'0000200003'
 refer=f'{BASE}/exam/examListWeb.asp?menu_cd={menu}&siteid={site}&subject_cd=MT&grade={grade}'
 try:
  response=page.request.post(BASE+'/exam/ajax/getMenuByFilterAjax.asp',
   form={'menuCD':menu,'siteID':site},
   headers={'Referer':refer,'Origin':BASE,'X-Requested-With':'XMLHttpRequest',
    'Accept':'application/json,text/javascript,*/*;q=0.01'},timeout=15000)
  payload=response.json()
  opts=payload.get('MENU_BY_EXAM',[])
  results={}
  for row in opts:
   if str(row.get('SITE_ID'))!=site or str(row.get('GRADE'))!=grade:continue
   cd=str(row.get('SUBJECT_CD') or '')
   if SUBJECT_CODE_RE.fullmatch(cd):
    results[cd]=safe(row.get('SUBJECT_NM') or cd,50)
  manifest.setdefault('subjectCatalog',{})[site+grade]={'http':response.status,
    'actualSubjects':[{'code':k,'name':v} for k,v in results.items()],'optionsSeen':len(opts)}
  if results:return list(results.items())
 except Exception as e:
  manifest['errors'].append({'screen':f'original_subject_catalog_{site}_{grade}',
    'error':safe(e,180)})
 return [(code,name) for code,name in DEFAULT_SUBJECTS.items()]

def matrix(page):
 combos=[(site,grade) for site in ('M','H') for grade in ('1','2','3')]
 if A.site and A.grade:combos=[(A.site,A.grade)]
 screen_count=0
 for site,grade in combos:
  subjects=subject_catalog(page,site,grade)
  print('ORIGINAL_SUBJECT_CATALOG',site,grade,subjects,flush=True)
  tasks=[(subject,name,label,mode) for subject,name in subjects for label,mode in TOP_MENU_CODES]
  subset=[t for i,t in enumerate(tasks) if i % A.shards==A.shard]
  if A.limit:subset=subset[:A.limit]
  print('MATRIX_QUEUED',site,grade,len(subset),'original subjects',len(subjects),flush=True)
  for subject,subjectName,label,mode in subset:
   ident=f'{site}_{grade}_{subject}_{label}'
   r=visit(page,ident,mode_url(site,grade,subject,mode),
     screenshot=(subject in ('EG','MT') and label=='unit' and grade in ('2','3')))
   # Actual nested menu codes read from original DOM for this precise grade-subject.
   if label not in ('concept','unit','practice','revision'):continue
   codes=[]
   for sub in (r.get('snapshot') or {}).get('subMenus',[]):
    m=re.search(r"'(\d{15})'",sub['onclick'])
    if m and m.group(1) not in codes:codes.append(m.group(1))
   for code in codes[:15]:
    key=ident+'_'+code
    visit(page,key,mode_url(site,grade,subject,code),screenshot=False)
   screen_count+=1
 print('MATRIX_SOURCE_CAPTURED',len(manifest['cases']),'screens',screen_count,'distinct source subject cases',flush=True)

def click_original_controls(page):
 """Actually click public original top and submenu tabs, rather than merely assuming URLs work."""
 clicked=[]
 for site,grade,subject in [('M','3','EG'),('M','3','MT'),('H','2','EG')]:
  landing=mode_url(site,grade,subject,'000010000200003')
  page.goto(landing,wait_until='domcontentloaded',timeout=25000)
  page.wait_for_timeout(1100)
  original=page.evaluate(SNAP_JS)
  for menu in original['topMenus'][:10]:
   url=menu.get('href') or ''
   if not url.startswith(BASE) or 'login' in url.lower() or 'payment' in url.lower():continue
   try:
    page.goto(landing,wait_until='domcontentloaded',timeout=25000)
    page.wait_for_timeout(800)
    # Select exact known original menu href, not a locally reconstructed link.
    link=page.locator('a[href]').filter(has_text=menu['name'].split('\n')[0][:7])
    anchor=next((a for a in page.locator('.tabLineRound a').all() if a.get_attribute('href') and a.get_attribute('href').replace('&amp;','&') in url),None)
    if anchor is None:continue
    anchor.click(timeout=3500)
    page.wait_for_timeout(1100)
    snap=page.evaluate(SNAP_JS)
    clicked.append({'site':site,'grade':grade,'subject':subject,
      'clicked':menu['name'],'actualUrl':snap['actualUrl'],
      'active':next((x['name'] for x in snap['topMenus'] if x['active']),None),
      'subMenus':[x['name'] for x in snap['subMenus']],
      'filters':[x['name'] for x in snap['filters']]})
   except Exception as e:clicked.append({'site':site,'subject':subject,'clicked':menu['name'],'error':safe(e,190)})
 write_json('actual_menu_clicks.json',clicked)
 print('ORIGINAL_TOP_MENU_CLICKED',len(clicked),flush=True)

def main():
 global current
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--disable-dev-shm-usage','--no-sandbox'])
  c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1,
    locale='ko-KR',user_agent='Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    ignore_https_errors=False)
  page=c.new_page()
  page.set_default_timeout(12000)
  page.on('response',on_response)
  page.on('pageerror',lambda e:manifest['errors'].append({'screen':current,'error':safe(e,320)}))
  if A.phase=='discovery':
   discover(page)
   click_original_controls(page)
  else:matrix(page)
  c.close();b.close()
 manifest['capturedAssets']=asset_data
 manifest['requests']=requests
 manifest['summary']={'screens':len(manifest['cases']),'success':sum('snapshot' in x for x in manifest['cases']),
    'failed':sum('error' in x for x in manifest['cases']),'publicXHR':len(requests),'uniqueAssets':len(asset_data),
    'uniqueResourceURLs':len(manifest['discoveredResources'])}
 write_json('manifest.json',manifest)
 print('INVENTORY_COMPLETE',json.dumps(manifest['summary'],ensure_ascii=False),flush=True)
if __name__=='__main__':main()
