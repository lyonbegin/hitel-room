#!/usr/bin/env python3
"""Build read-only, sanitized, faithful original mobile pages from 700 real Playwright captures.

Input is a separate immutable git branch archive, never fake data:
  archive/zocbo-original-browser-sources-20261108
  archive/zocbo-public-filters-M1/M2/M3/H1/H2-20261108

Output is one index + one per-original-browser-case sanitized DOM. No onclick,
inline scripts, cookies or login forms. Identifiers are original source IDs.
"""
import json,re,sys,collections
from pathlib import Path
from bs4 import BeautifulSoup
SOURCE=Path(sys.argv[1])/'archive/zocbo-original-sources-20261108'
FILTER=Path(sys.argv[2]) if len(sys.argv)>2 else Path('/missing')
OUT=Path('public/zocbo-faithful-pages')
OUT.mkdir(parents=True,exist_ok=True)
INDEX={'version':2,'source':'official-anonymous-mobile-Playwright-2026-11-08',
       'cases':{},'byView':{},'subjects':{},'stats':{}}
def write(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf8')
def data_opts(case,grade):
 p=FILTER/('original-filters/'+grade+'/cases/'+case+'.json')
 if not p.exists():return {}
 try:meta=json.loads(p.read_text('utf8'))
 except: return {}
 result={}
 for row in meta.get('filters',[]):
  onclick=row.get('onclick','')
  m=re.search(r"getBottomSheetLayer\('([A-Z_]+)'",onclick)
  key=m.group(1) if m else row.get('dataAct') or ''
  if not key:continue
  html=row.get('html','')
  if not html:continue
  s=BeautifulSoup(html,'html.parser')
  opts=[]
  for li in s.select('li.check__item'):
   label=li.select_one('label')
   inp=li.select_one('input')
   if not label:continue
   name=' '.join(label.stripped_strings)
   name=re.sub(r'\s+',' ',name).strip()
   if not name:continue
   call=inp.get('onclick','') if inp else ''
   action=re.search(r"selectedBottomSheetRadioItem\(this,\s*'[^']+',\s*'([^']*)'",call)
   opts.append({'name':name,'value':action.group(1) if action else (inp.get('value','') if inp else ''),
                'selected':bool(inp and inp.has_attr('checked'))})
  if not opts:
   seen=set()
   for el in s.select('#bottomSheetLayerBody li'):
    txt=el.get_text(' ',strip=True)
    if txt and txt not in seen and len(txt)<90:
     opts.append({'name':txt,'value':'','selected':False})
     seen.add(txt)
  if opts:result[key]=opts[:300]
 return result
def scrub(el):
 if el is None:return ''
 for tag in list(el.find_all(True)):
  if tag.name in ('script','style','iframe','object','embed','form'):
   tag.decompose();continue
  attrs=list(tag.attrs.keys())
  for a in attrs:
   if a.lower().startswith('on'):
    if a.lower()=='onclick':
     call=tag.attrs.get(a,'')
     if 'goExpaprLayer' in call or 'goDownLayer' in call:
      mat=re.search(r"'(\d{5,})'",call)
      if mat:
       tag['data-zb-paper-id']=mat.group(1)
       tag['data-zb-paper-kind']='exam' if 'goExpaprLayer' in call else 'video'
    del tag.attrs[a]
   elif a in ('srcset','srcdoc'):
    del tag.attrs[a]
  if tag.has_attr('href'):
   href=tag.attrs['href']
   if isinstance(href,str) and href.lower().startswith(('javascript:','data:')):
    del tag.attrs['href']
  if tag.name=='img' and tag.has_attr('src'):
   src=tag['src']
   if src.startswith('/'):tag['src']='https://m.zocbo.com'+src
 return str(el)
def infer_category(caseid):
 parts=caseid.split('_')
 if len(parts)<4:return ('unknown','')
 return (parts[3],parts[4] if len(parts)>4 else '')
case_count=0;missing=0;distinct=collections.Counter()
for site in ('M','H'):
 for grade in ('1','2','3'):
  group=site+grade
  manifest_path=SOURCE/group/'manifest.json'
  if not manifest_path.exists():raise SystemExit('Missing original browser source '+str(manifest_path))
  source=json.loads(manifest_path.read_text('utf8'))
  INDEX['subjects'][group]=source.get('subjectCatalog',{}).get(group,{}).get('actualSubjects',[])
  for row in source.get('cases',[]):
   snap=row.get('snapshot')
   if not snap:continue
   case=row['id']
   category,code=infer_category(case)
   original_url=snap.get('actualUrl','')
   real_site=re.search(r'[?&]siteid=(M|H)',original_url)
   real_subject=re.search(r'[?&]subject_cd=([A-Z0-9]+)',original_url)
   real_grade=re.search(r'[?&]grade=(\d)',original_url)
   requested_parts=case.split('_')
   subject=requested_parts[2] if len(requested_parts)>2 else ''
   orig=SOURCE/group/row.get('domFile','')
   if not orig.exists():missing+=1;continue
   soup=BeautifulSoup(orig.read_text('utf8',errors='replace'),'html.parser')
   exam=soup.select_one('#examMain')
   if exam:fragment=scrub(exam)
   elif category=='school':
    target=soup.select_one('#row_A') or soup.select_one('#row_B') or soup.select_one('#contents')
    fragment=scrub(target)
   elif category=='gangnam':
    target=soup.select_one('#list_A') or soup.select_one('#row_A') or soup.select_one('#contents')
    fragment=scrub(target)
   else:
    target=soup.select_one('#contents') or soup.select_one('#section')
    fragment=scrub(target)
   metadata={
     'case':case,'site':site,'grade':grade,'subject':subject,
     'originalSite':real_site.group(1) if real_site else site,
     'originalSubject':real_subject.group(1) if real_subject else subject,
     'originalGrade':real_grade.group(1) if real_grade else grade,
     'category':category,'subCode':code,'originalUrl':original_url,
     'top':snap.get('topMenus',[]),'sub':snap.get('subMenus',[]),
     'filters':snap.get('filters',[]),
     'filterOptions':data_opts(case,group),
     'episodeCount':snap.get('episodes',0),
     'recordCount':snap.get('rowsDOMCount',0),
     'sourceHTML':row.get('domFile',''),
     'originalPublicRequests':[{'path':x.get('path',''),'form':x.get('publicFilterForm','')} for x in source.get('requests',[]) if x.get('screen')==case and x.get('path','') in ('/exam/ajax/getMenuByExamSearchAjax.asp','/exam/ajax/getMenuByExamPartAjax.asp') and x.get('publicFilterForm')],
     'html':fragment
   }
   write(OUT/(case+'.json'),metadata)
   INDEX['cases'][case]={
      k:metadata[k] for k in ('site','grade','subject','originalSite','originalSubject','originalGrade',
        'category','subCode','originalUrl','top','sub','filters','filterOptions','episodeCount','recordCount')
   }
   if category in ('concept','unit','practice','revision','school','gangnam'):
    k=':'.join([site,grade,subject,category])
    INDEX['byView'].setdefault(k,[])
    INDEX['byView'][k].append(case)
   case_count+=1
   distinct[category]+=1
INDEX['stats']={'cases':case_count,'sourceDomMissing':missing,'categories':dict(distinct),
                'gradeGroups':list(INDEX['subjects'])}
write(Path('public/zocbo-faithful-index.json'),INDEX)
print('FAITHFUL_SOURCE_COMPILED',json.dumps(INDEX['stats'],ensure_ascii=False),flush=True)
print('INDEX_BYTES',Path('public/zocbo-faithful-index.json').stat().st_size)
