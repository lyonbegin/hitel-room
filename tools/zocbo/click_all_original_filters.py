#!/usr/bin/env python3
"""Click actual official mobile filter selectors, save all visible options and original modal DOM.
Uses the exhaustive prior page inventory as seeds; does not guess per-subject menus.
Read-only clicks: do not select paid exams, authenticate, buy, or download.
"""
import argparse,json,re,time,collections
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--manifest',required=True)
parser.add_argument('--out',required=True)
args=parser.parse_args()
origin=json.loads(Path(args.manifest).read_text('utf8'))
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
main=[]
for c in origin['cases']:
 parts=c.get('id','').split('_')
 if len(parts)!=4 or parts[3] not in ('concept','unit','practice','revision'):continue
 if not c.get('snapshot'):continue
 main.append(c)
# School / Gangnam use same original page for every subject; one is sufficient per grade.
for label in ('school','gangnam'):
 x=next((c for c in origin['cases'] if len(c.get('id','').split('_'))==4 and c['id'].endswith('_'+label) and c.get('snapshot')),None)
 if x:main.append(x)
rows=[]
stats={'cases':0,'filters':0,'clicked':0,'disabledOrMissing':0,'failed':0,'uniqueFilterTypes':set()}
js=r"""() => {
 const sheet=document.querySelector('#bottomSheetLayer');
 const visible=e=>{try{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}catch{return false}};
 const candidates=sheet?[...sheet.querySelectorAll('button,a,li,label,input,select,option,[role=option]')]:[];
 const opts=candidates.filter(visible).map(x=>({
  text:(x.innerText||x.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,100),
  tag:x.tagName,role:x.getAttribute('role')||'',
  value:x.getAttribute('data-value')||x.getAttribute('value')||'',
  dataAction:x.getAttribute('data-act')||x.getAttribute('data-action')||'',
  onclick:(x.getAttribute('onclick')||'').slice(0,200),
  disabled:!!x.disabled
 })).filter(x=>x.text).slice(0,450);
 return {open:!!sheet&&visible(sheet),title:sheet?.querySelector('.bottomSheet__header')?.innerText?.trim()||'',
  html:sheet?.outerHTML.slice(0,75000)||'',
  options:opts,
  visibleBodyTail:(document.body?.innerText||'').slice(-950)};
}"""
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 page=context.new_page()
 for index,c in enumerate(main):
  source=c['snapshot']
  record={'case':c['id'],'url':source.get('actualUrl'), 'filters':[]}
  filters=source.get('filters',[])
  for fi,f in enumerate(filters):
   name=f.get('name','')
   action=f.get('onclick','')
   legacy=f.get('action','')
   label=f.get('class','')
   key=(legacy or re.search(r"getBottomSheetLayer\('([^']+)'",action).group(1)
     if re.search(r"getBottomSheetLayer\('([^']+)'",action) else label)
   stats['uniqueFilterTypes'].add(key)
   item={'name':name,'sourceClass':label,'onclick':action,'dataAct':legacy,'options':[]}
   stats['filters']+=1
   try:
    page.goto(c['requested'],wait_until='domcontentloaded',timeout=25000)
    page.wait_for_timeout(600)
    selector=None
    m=re.search(r"getBottomSheetLayer\('([^']+)'",action)
    if m:selector='button.'+m.group(1)
    elif legacy:selector='button[data-act="'+legacy+'"]'
    if selector:
     loc=page.locator(selector).first
     if loc.count() and loc.is_visible() and loc.is_enabled():
      loc.click(timeout=4500)
      page.wait_for_timeout(340)
      d=page.evaluate(js)
      item.update(d)
      stats['clicked']+=1
      if c['id'] in ('M_3_EG_unit','M_2_MT_unit','H_2_EG_unit') and fi<5:
       sd=out/'screens';sd.mkdir(exist_ok=True)
       fn=c['id']+'_'+re.sub(r'[^a-zA-Z0-9_-]','',key)+'.png'
       page.screenshot(path=str(sd/fn),full_page=False)
       item['screenFile']='screens/'+fn
     else:
      stats['disabledOrMissing']+=1
      item['notClicked']='disabled-or-missing'
    else:
     stats['disabledOrMissing']+=1
     item['notClicked']='no-click-event'
   except Exception as e:
    stats['failed']+=1
    item['error']=str(e)[:250]
   record['filters'].append(item)
  (out/'cases').mkdir(exist_ok=True)
  (out/'cases'/(c['id']+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
  rows.append({'case':c['id'],'filterCount':len(filters),'clicked':sum('html' in x for x in record['filters']),
   'disabled':sum('notClicked' in x for x in record['filters']),
   'errors':sum('error' in x for x in record['filters'])})
  stats['cases']+=1
  print('FILTER_MENU_CASE',c['id'],rows[-1],flush=True)
 context.close();b.close()
stats['uniqueFilterTypes']=sorted(stats['uniqueFilterTypes'])
(out/'report.json').write_text(json.dumps({'summary':stats,'cases':rows},ensure_ascii=False,indent=2),encoding='utf8')
print('ALL_ORIGINAL_FILTERS_COLLECTED',json.dumps(stats,ensure_ascii=False),flush=True)
