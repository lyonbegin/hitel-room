#!/usr/bin/env python3
"""Anonymous, read-only inventory of official Zocbo mobile pages for inline DOM rebuild.
Raw response and static public asset files are archived only as short-lived CI evidence.
No login, cookies, private API invocation, download execution, or deploy of site JS.
"""
import json, re, time, pathlib, hashlib, collections, urllib.parse
import requests
from bs4 import BeautifulSoup

TARGETS = {
 'app-home':'https://m.zocbo.com/app/main_v2.asp',
 'login':'https://m.zocbo.com/Member/login.asp',
 'event-documents':'https://m.zocbo.com/event/pre-test2026d/',
 'middle-exam-list':'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT',
 'high-exam-list':'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=EG',
 'free-reading':'https://m.zocbo.com/Freetrial/FreeReading.asp',
 'free-reading-web':'https://m.zocbo.com/exam/school/previousexam.asp?search_webview=Y',
 'school-expect':'https://m.zocbo.com/M/expected.asp'
}
ROOT=pathlib.Path('zocbo-inline-evidence');ROOT.mkdir(exist_ok=True)
sess=requests.Session();sess.headers.update({'User-Agent':'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'})
host_allow={'m.zocbo.com','zocbo.com','www.zocbo.com','static.zocbo.com','cdn.zocbo.com'}
page_report={};assets=[];asset_ids=set();counter=collections.Counter()
def safeurl(url):
 try:
  u=urllib.parse.urlparse(url)
  return u.scheme=='https' and (u.hostname in host_allow or (u.hostname or '').endswith('.zocbo.com'))
 except Exception:return False
def trim(s,n=180):return re.sub(r'\s+',' ',str(s)).strip()[:n]
def add_asset(url,typ,from_page):
 if not safeurl(url):return
 k=(url,typ)
 if k in asset_ids:return
 asset_ids.add(k);assets.append({'url':url,'kind':typ,'seen_at':from_page})
def nodes(soup, selectors):
 out=[]
 for selector in selectors:
  arr=soup.select(selector)
  out.append({'selector':selector,'count':len(arr),
   'examples':[{'tag':n.name,'id':n.get('id'),'class':n.get('class',[]),'text':trim(n.get_text(' ',strip=True),100)} for n in arr[:3]]})
 return out
for name,url in TARGETS.items():
 try:
  res=sess.get(url,timeout=26,allow_redirects=True)
  if len(res.content)>12_000_000:raise ValueError('HTML >12MiB')
  res.encoding=res.apparent_encoding if res.encoding and res.encoding.lower()=='iso-8859-1' else res.encoding
  soup=BeautifulSoup(res.text,'html.parser')
  (ROOT/(name+'.html')).write_text(res.text,encoding='utf-8')
  styles=[];scripts=[];imgs=[];forms=[];clicks=[]
  for n in soup.select('link[rel~="stylesheet"][href], link[rel~="preload"][as="style"][href]'):
   u=urllib.parse.urljoin(res.url,n.get('href',''))
   styles.append(u);add_asset(u,'css',name)
  for n in soup.select('script[src]'):
   u=urllib.parse.urljoin(res.url,n.get('src',''))
   scripts.append(u);add_asset(u,'js',name)
  for n in soup.select('img[src]')[:180]:
   u=urllib.parse.urljoin(res.url,n.get('src',''))
   imgs.append({'url':u,'alt':trim(n.get('alt',''),80),'class':n.get('class',[])})
   add_asset(u,'image',name)
  for n in soup.select('form')[:40]:
   forms.append({'action':urllib.parse.urljoin(res.url,n.get('action','')),'method':n.get('method','GET'),'id':n.get('id'),'name':n.get('name'),'inputs':[{'name':x.get('name'),'type':x.get('type'),'id':x.get('id')} for x in n.select('input')[:45]]})
  for n in soup.select('a[href],button,input[type=submit],[onclick],[data-act],[data-url]')[:2500]:
   label=trim(n.get_text(' ',strip=True) or n.get('value','') or n.get('title',''),90)
   action=n.get('onclick','') or n.get('data-act','') or n.get('data-url','')
   href=n.get('href')
   if re.search(r'다운|다운로드|검색|문제|시험|자료|보기|열람|로그인|무료|기출|프린트|미리|해설|뷰어',label+' '+str(action),re.I):
    clicks.append({'tag':n.name,'text':label,'id':n.get('id'),'class':n.get('class',[]),'href':urllib.parse.urljoin(res.url,href) if href else None,'onclick':trim(action,280),'data-act':n.get('data-act'),'data-src':n.get('data-src'),'data-grade':n.get('data-grade'),'data-siteid':n.get('data-siteid'),'data-subjcode':n.get('data-subjcode')})
  head=soup.head
  report={'request_url':url,'resolved_url':res.url,'status':res.status_code,'bytes':len(res.content),'title':trim(soup.title.get_text(' ',strip=True),200) if soup.title else '', 'sha256':hashlib.sha256(res.content).hexdigest(),
  'html_root_attrs':dict(soup.html.attrs) if soup.html else {},'body_attrs':dict(soup.body.attrs) if soup.body else {},
  'metas':[str(m)[:400] for m in soup.select('meta')[:25]],'styles':styles,'scripts':scripts,'images':imgs[:100],'forms':forms,'important_controls':clicks[:220],
  'layout_candidates':nodes(soup,['body','header','footer','main','nav','.container','.content','.wrap','.inner','.header','.footer','.gnb','.lnb','.list','.content_wrap','#container','#contents','#wrap','#header','#footer','[data-act="sampleDown"]','[class*="download"]']),
  'csp':res.headers.get('Content-Security-Policy','')[:800], 'x_frame_options':res.headers.get('X-Frame-Options',''),
  'body_text_head':trim(soup.get_text(' ',strip=True),1200)}
  page_report[name]=report
  print(f'PAGE {name}: {res.status_code}, {len(res.content):,} bytes, css={len(styles)}, js={len(scripts)}, matched_actions={len(clicks)}, resolved={res.url}')
 except Exception as e:
  page_report[name]={'url':url,'error':str(e)}
  print(f'PAGE_ERROR {name}: {str(e)[:180]}')
(ROOT/'page-dom-report.json').write_text(json.dumps(page_report,ensure_ascii=False,indent=2))
# Retrieve public CSS/JS for dependency inspection only; avoid executing or auto-injecting it.
# Limit to 50 CSS and 40 JS URLs, avoid large bundles.
manifest=[]
type_budget={'css':50,'js':95}
for typ in ('css','js'):
 matching=[a for a in assets if a['kind']==typ]
 if typ=='js':
  priorities=['pre-test2026d','pre-test.js','Download_New.js','newChapterSelector_preTest','login.js','Exam.js']
  matching.sort(key=lambda v:(0 if any(x.lower() in v['url'].lower() for x in priorities) else 1, v['url']))
 matching=matching[:type_budget[typ]]
 for j,a in enumerate(matching):
  u=a['url']
  try:
   r=sess.get(u,timeout=18)
   limit=7_500_000 if typ=='css' else 1_600_000
   if r.status_code!=200 or len(r.content)>limit:raise ValueError(f'asset unavailable/above size limit: {r.status_code}/{len(r.content)}')
   contenttype=r.headers.get('Content-Type','')
   name=f'{typ}/{j:03d}.'+('css' if typ=='css' else 'js')
   fp=ROOT/name;fp.parent.mkdir(parents=True,exist_ok=True);fp.write_bytes(r.content)
   manifest.append({'kind':typ,'source':u,'path':name,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'content_type':contenttype})
   counter[f'{typ}_saved']+=1
   if typ=='css':
    txt=r.text
    for item in re.findall(r'url\(\s*["\']?([^)"\']+)',txt)[:150]:
     v=urllib.parse.urljoin(u,item)
     add_asset(v,'css-url-asset',name)
    for item in re.findall(r'@import\s+(?:url\()?["\']?([^\'")\s;]+)',txt)[:20]:
     v=urllib.parse.urljoin(u,item);add_asset(v,'css-import',name)
   elif typ=='js':
    txt=r.text
    keyhits=re.findall(r'.{0,150}(?:sampleDown|download|openViewer|WebView|Login|search|api/).{0,200}',txt,flags=re.I)[:50]
    if keyhits:
     (ROOT/f'js/{j:03d}-callsite-excerpts.txt').write_text('\n'.join(keyhits),encoding='utf-8')
  except Exception as e:
   manifest.append({'kind':typ,'source':u,'error':str(e)[:150]})
counter['pages']=len(page_report)
(ROOT/'asset-report.json').write_text(json.dumps({'downloaded':manifest,'all_discovered_asset_urls':assets,'count':dict(counter)},ensure_ascii=False,indent=2))
print(json.dumps({'pages':len(page_report),'saved_css':counter['css_saved'],'saved_js':counter['js_saved'],'discovered_asset_urls':len(assets)},ensure_ascii=False))
