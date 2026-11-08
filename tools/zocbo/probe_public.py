#!/usr/bin/env python3
"""Record only public official Zocbo HTML and exact hrefs / download handlers.
Never simulate a login or download a paywalled file.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
import requests,bs4,json,re
P=Path('zocbo-public');P.mkdir(exist_ok=True)
URLS={
 'original_app_home':'https://m.zocbo.com/app/main_v2.asp',
 'official_home':'https://m.zocbo.com/',
 'official_login':'https://m.zocbo.com/Member/login.asp',
 'free_school_view':'https://m.zocbo.com/Freetrial/FreeReading.asp',
 'term_final_2026':'https://m.zocbo.com/event/pre-test2026d/',
 'school_exam_m1':'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT',
 'school_exam_m2':'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT',
 'school_exam_h1':'https://m.zocbo.com/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=MT',
 'learning_diagnostic':'https://m.zocbo.com/Freetrial/learningtest.asp',
 'last_minute':'https://m.zocbo.com/guide/revision/default_M.asp',
 'school_expected':'https://m.zocbo.com/M/expected.asp'
}
sess=requests.Session()
sess.headers.update({'User-Agent':'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36'})
all={}
for name,url in URLS.items():
 try:
  r=sess.get(url,timeout=24,allow_redirects=True)
  r.encoding=r.apparent_encoding if r.encoding and r.encoding.lower()=='iso-8859-1' else r.encoding
  soup=bs4.BeautifulSoup(r.text,'html.parser')
  scripts=[urljoin(r.url,tag.get('src')) for tag in soup.select('script[src]')][:100]
  links=[]
  for tag in soup.select('a[href]'):
   href=tag.get('href','').strip();txt=tag.get_text(' ',strip=True)[:180]
   if href and not href.lower().startswith(('javascript:','tel:','mailto:','#')):
    links.append({'title':txt,'url':urljoin(r.url,href),'onclick':tag.get('onclick','')[:250]})
  controls=[]
  for tag in soup.select('button,input[type="button"],input[type="submit"]'):
   label=tag.get_text(' ',strip=True) or tag.get('value','')
   onclick=tag.get('onclick','')
   if label or onclick:
    controls.append({'name':label[:130], 'onclick':onclick[:500],'id':tag.get('id'),'class':tag.get('class',[])})
  text=soup.get_text(' ',strip=True)
  data={'url':url,'resolved':r.url,'status':r.status_code,'title':soup.title.get_text(' ',strip=True) if soup.title else '', 'bodyChars':len(text),'textPreview':text[:1000],'links':links[:1200],'controls':controls[:500],'scripts':scripts}
  all[name]=data
  (P/(name+'.html')).write_text(r.text,encoding='utf-8')
  print(name, r.status_code,len(r.content),'links',len(links),'buttons',len(controls),'resolved',r.url)
 except Exception as e:
  all[name]={'url':url,'error':str(e)}
  print('ERR',name,str(e))
(P/'public-route-evidence.json').write_text(json.dumps(all,ensure_ascii=False,indent=2))
# Extract only real grade/subject captions, not fabricated titles.
s=all.get('term_final_2026',{})
(P/'term-final-2026-evidence.json').write_text(json.dumps({'url':URLS['term_final_2026'],'title':s.get('title'),'links':s.get('links',[]),'controls':s.get('controls',[])},ensure_ascii=False,indent=2))
