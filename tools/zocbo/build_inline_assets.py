#!/usr/bin/env python3
"""Generate a local, iframe-free original Zocbo data section and scoped stylesheet.

Source: PUBLIC HTTPS 2026 final-exam page. No session, credentials, access
checks, downloads, or remote JS. Exports only an original DOM subsection.
"""
from pathlib import Path
import requests, json, re, hashlib, tinycss2
from bs4 import BeautifulSoup
URL='https://m.zocbo.com/event/pre-test2026d/'
CSS_URL='https://m.zocbo.com/cloudfront/css/event/pre-test2026d/mo/default.css?20261106152501'
out=Path('public');out.mkdir(exist_ok=True)
session=requests.Session();session.headers['User-Agent']='Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/131 Safari/537.36'
response=session.get(URL,timeout=30);response.raise_for_status()
response.encoding=response.apparent_encoding if response.encoding.lower()=='iso-8859-1' else response.encoding
soup=BeautifulSoup(response.text,'html.parser')
original=soup.select_one('main#event-content .promotion__section.is-data .keyvisual__inner')
assert original, 'Original HTML document section missing'
tabs=original.select('.ui-tab')
assert len(tabs)==2,'Expected original middle+high school tabs'
blocks=[]
for node in original.children:
 if getattr(node,'name',None) in ['h2','p'] and 'title__content' in (node.get('class') or []) or getattr(node,'name',None)=='h2':
  blocks.append(node)
for tab in tabs:blocks.append(tab)
root=BeautifulSoup('<main class="promotion" id="event-content"><section class="promotion__section is-data"><div class="keyvisual__inner"></div></section></main>','html.parser')
body=root.select_one('.keyvisual__inner')
for element in blocks:
 body.append(BeautifulSoup(str(element),'html.parser'))
for node in root.select('[track_cd], [class*=TRACK_TRG]'):
 node.attrs.pop('track_cd',None)
 node['class']=[c for c in node.get('class',[]) if c not in ['TRACK_TRG']]
for node in list(root.select('script,iframe,form,style,svg,link,object,embed')):
 node.decompose()
for node in list(root.find_all()):
 for key in list(node.attrs):
  if key.lower().startswith('on'):del node.attrs[key]
 if node.name=='a':
  href=node.get('href','')
  if not href.startswith('https://m.zocbo.com/'):
   node.attrs.pop('href',None)
for b in root.select('.button__downlist.hide'):
 b.decompose()
# Source active tab chosen at build-time is overridden by runtime state.
for x in root.select('.ui-tab-nav button'):
 x.attrs.pop('onclick',None)
 x['type']='button';x['data-action']='zbEventTab';x['data-value']=x.get_text(' ',strip=True)
for button in root.select('button[data-act="sampleDown"]'):
 siteid=button.get('data-siteid');grade=button.get('data-grade');subject=button.get('data-subjcode')
 assert siteid in ('M','H') and grade in ('1','2','3') and re.fullmatch('[A-Z0-9]{2,5}',subject)
 button['data-action']='zbOriginalDownload'
 button['data-id']=siteid+grade+'-'+subject
 button.attrs.pop('onclick',None)
button_count=len(root.select('button[data-action="zbOriginalDownload"]'))
assert button_count==35, f'Expected 35 real download controls, got {button_count}'
for row in root.select('.ui-tab-content .data__item'):
 button=row.select_one('button[data-id]')
 if button:row['data-doc-id']=button['data-id']
for row in root.select('.data__item'):
 if row.find('img'): raise AssertionError('Unexpected source image in document row')
markup=str(root)
hashv=hashlib.sha256(response.content).hexdigest()
payload={'source':URL,'sha256':hashv,'count':button_count,'originalMarkup':markup,'groups':[{'name':t.get('class'), 'grades':[x.get('data-value') for x in t.select('.ui-tab-nav button')]} for t in root.select('.ui-tab')]}
(out/'zocbo-original-event.js').write_text('window.ZOCBO_ORIGINAL_EVENT='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
# Bundle only ORIGINAL event CSS rules relevant to the extracted data section,
# not the reset/global site styles. Prefix to never alter HITEL shell.
raw=session.get(CSS_URL,timeout=30);raw.raise_for_status()
raw.encoding=raw.apparent_encoding if raw.encoding.lower()=='iso-8859-1' else raw.encoding
rules=tinycss2.parse_stylesheet(raw.text,skip_comments=True,skip_whitespace=True)
selected=[]
for rule in rules:
 if rule.type!='qualified-rule':continue
 selector=tinycss2.serialize(rule.prelude).strip()
 if not selector.startswith('.promotion'):continue
 if not any(t in selector for t in ('.ui-tab','.is-data','h2.section__title','.title__content','.font-primary')):continue
 if any(t in selector for t in ('.swiper','.voucher__content','.hijeckingBanner')):continue
 declaration=tinycss2.serialize(rule.content)
 parts=[x.strip() for x in selector.split(',')]
 selected.append(','.join('.zb-inline-root '+x for x in parts)+'{'+declaration+'}')
assert len(selected)>=23, f'Missing CSS rules: {len(selected)}'
css='''/* Original source: '''+CSS_URL+''' ; extracted only rules used by the original 2026 exam DOM.
No global resets, headers, ads, popup skins or third-party script are included. */
'''+''.join(selected)+'''
.zb-inline-root {width:100%;min-width:0;overflow:visible;box-sizing:border-box;font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.zb-inline-root *, .zb-inline-root *::before,.zb-inline-root *::after{box-sizing:border-box}
.zb-inline-root .promotion{background:#fff;width:100%;margin:0}
.zb-inline-root .promotion .promotion__section.is-data{padding:4px 0 18px!important;width:100%;min-width:0;overflow:visible}
.zb-inline-root .promotion .promotion__section.is-data .keyvisual__inner{max-width:none;padding:0;margin:0}
.zb-inline-root .promotion .ui-tab{margin-top:18px}
.zb-inline-root .promotion .ui-tab.is-secondary{margin-top:10px}
.zb-inline-root .promotion .ui-tab .ui-tab-nav{gap:5px}
.zb-inline-root .promotion .ui-tab .ui-tab-nav button{width:100%;min-width:0;height:41px;margin:0!important;font-size:14px;cursor:pointer;border:0}
.zb-inline-root .promotion .promotion__section h2.section__title{font-size:19px;line-height:1.4}
.zb-inline-root .promotion .promotion__section .font-primary{font-size:22px}
.zb-inline-root .promotion .promotion__section.is-data .has-data1st{padding:8px;background:#f6f6f6}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item{padding:12px 13px}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item .data__subject{font-size:12px}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item .data__subject strong{font-size:17px;margin:3px 0 11px}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item .data__download{height:44px;background:none;padding:0;border:0}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item .data__download:focus-visible{outline:2px solid #3768ea;outline-offset:2px}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__item .data__download span{font-size:14px}
.zb-inline-root .promotion .ui-tab .ui-tab-content[data-active="1"]{display:block!important}
.zb-inline-root .promotion .ui-tab .ui-tab-content:not([data-active="1"]){display:none!important}
.zb-inline-root .promotion .ui-tab .ui-tab-nav button[data-selected="1"]{color:#fff;background:#171719!important}
.zb-inline-root .promotion .ui-tab .ui-tab-nav button[data-selected="0"]{color:#555;background:#f1f1f1!important}
.zb-inline-root .data__item[data-selected="1"]{border:2px solid #3768ea!important;background:#f7faff!important}
.zb-inline-root .data__item[hidden]{display:none!important}
.zb-inline-root .promotion .promotion__section.is-data .ui-tab .ui-tab-container .ui-tab-content .data__total{font-size:12px}
.zb-inline-root .zocbo-primary-cta{border:0;color:#fff;background:#3768ea;border-radius:9px;padding:13px 16px;width:100%;font-weight:700;cursor:pointer;font-size:14px}
.zb-inline-root .zocbo-inline-note{font-size:12px;line-height:1.6;color:#555;padding:12px;background:#f5f7fb;border:1px solid #e3e7f0;border-radius:8px;margin:9px 0}
.zb-inline-root .zocbo-doc-context{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0 13px}
.zb-inline-root .zocbo-doc-context span{background:#eef2fb;color:#3a4f76;padding:6px 9px;border-radius:15px;font-size:11px}
@media(max-width:400px){.zb-inline-root .promotion .promotion__section.is-data .has-data1st{padding:7px}}
'''
(out/'zocbo-original-event.css').write_text(css,encoding='utf-8')
report={'source':URL,'sha256':hashv,'count':button_count,'css_url':CSS_URL,'css_sha256':hashlib.sha256(raw.content).hexdigest(),'css_rules':len(selected),'doc_controls':[{'id':b.get('data-id'),'grade':b.get('data-grade'),'subjcode':b.get('data-subjcode'),'siteid':b.get('data-siteid'),'term':b.get('data-term')} for b in root.select('button[data-act="sampleDown"]')]}
Path('zocbo-inline-source-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'rows':button_count,'css_rules':len(selected),'markup_bytes':len(markup),'css_bytes':len(css),'source':URL},ensure_ascii=False))
