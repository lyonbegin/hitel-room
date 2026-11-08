#!/usr/bin/env python3
"""Reproduce recorded anonymous original browser AJAX requests and archive response bodies.
Addresses a source-site quirk: original AJAX often reports application data as text/html.
Never copies original cookies or account state; no private, mutation, paid or login endpoints.
"""
import argparse,collections,hashlib,json,time,re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--manifest',required=True)
p.add_argument('--out',required=True)
a=p.parse_args()
source=json.loads(Path(a.manifest).read_text(encoding='utf8'))
out=Path(a.out);(out/'bodies').mkdir(parents=True,exist_ok=True)
screens={c['id']:c.get('requested','') for c in source.get('cases',[])}
seen=set();items=[];body_count=0
allow={
 '/exam/ajax/getMenuByFilterAjax.asp','/exam/ajax/getMenuByExamPartAjax.asp',
 '/exam/ajax/getMenuByExamSearchAjax.asp','/exam/ajax/getWorkFilterAjax.asp',
 '/exam/ajax/getAssociateAjax.asp','/exam/ajax/getKoreanLiteratureAjax.asp',
 '/_api/community.api.asp'
}
recs=source.get('requests',[])
for r in recs:
 if not r.get('method') in ('POST','GET'):continue
 path=r.get('path','')
 if path not in allow:continue
 form=r.get('publicFilterForm')
 if r['method']=='POST' and form is None:continue
 refer=screens.get(r.get('screen',''),'')
 if not refer.startswith('https://m.zocbo.com'):continue
 sig=(path,r.get('method'),form or '',refer)
 if sig in seen:continue
 seen.add(sig)
 items.append((r,sig))
summary={'recorded':len(recs),'allowlistedUnique':len(items),'replayed':0,'json':0,'html':0,
  'errors':0,'oversize':0,'statuses':collections.Counter(),'screensWithBodies':set()}
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,locale='ko-KR')
 for i,(r,(path,method,form,refer)) in enumerate(items):
  record={'screen':r['screen'],'path':path,'method':method,'form':form[:1200] if form else '',
          'referer':refer,'originalHTTP':r.get('status')}
  try:
   headers={'Referer':refer,'Origin':'https://m.zocbo.com',
     'X-Requested-With':'XMLHttpRequest','Accept':'application/json,text/javascript,*/*;q=0.01'}
   if method=='POST':
    headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8'
    resp=ctx.request.post('https://m.zocbo.com'+path,data=form,headers=headers,timeout=18000)
   else:
    resp=ctx.request.get('https://m.zocbo.com'+path,headers=headers,timeout=18000)
   record['http']=resp.status
   content=resp.body()
   record['bytes']=len(content)
   record['contentType']=resp.headers.get('content-type','')
   summary['statuses'][str(resp.status)]+=1
   if len(content)>1600000:
    summary['oversize']+=1;record['outcome']='TOO_LARGE_TO_ARCHIVE'
   else:
    try:
     payload=json.loads(content)
     kind='json';summary['json']+=1
     if isinstance(payload,dict):
      record['rootKeys']=list(payload)[:35]
      record['originalCount']={k:payload.get(k) for k in ('EXAM_COUNT','RecordCount','count') if k in payload}
      for key in ('MENU_BY_EXAM','MENU_BY_PART','list'):
       if isinstance(payload.get(key),list):record[key+'Count']=len(payload[key])
    except Exception:
     kind='html';summary['html']+=1
     record['preview']=content[:240].decode('utf8',errors='replace')
    sha=hashlib.sha256((repr(sig)+str(i)).encode()).hexdigest()[:20]
    fn=sha+('.json' if kind=='json' else '.html')
    (out/'bodies'/fn).write_bytes(content)
    record['responseFile']='bodies/'+fn
    record['bodySha256']=hashlib.sha256(content).hexdigest()
    record['outcome']='CAPTURED'
    summary['screensWithBodies'].add(r['screen'])
   summary['replayed']+=1
  except Exception as e:
   summary['errors']+=1
   record['error']=str(e)[:210]
  results.append(record)
  if (i+1)%30==0:
   print('PUBLIC_AJAX_REPLAY',i+1,'/',len(items),'json',summary['json'],'html',summary['html'],'errors',summary['errors'],flush=True)
  # Keep traffic modest; only public read-only menu AJAX.
  time.sleep(0.06)
 ctx.close();browser.close()
summary['statuses']=dict(summary['statuses'])
summary['screensWithBodies']=len(summary['screensWithBodies'])
(out/'responses_manifest.json').write_text(json.dumps({'summary':summary,'responses':results},ensure_ascii=False,indent=2),encoding='utf8')
print('PUBLIC_AJAX_ARCHIVED',json.dumps(summary,ensure_ascii=False),flush=True)
if not results or summary['replayed']==0:raise SystemExit('NO_ORIGINAL_AJAX_RESPONSES_COLLECTED')
