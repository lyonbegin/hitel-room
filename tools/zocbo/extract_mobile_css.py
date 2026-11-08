#!/usr/bin/env python3
"""Extract only applicable original public Zocbo mobile CSS rules into a scoped HITEL sector.

Actual source https://m.zocbo.com/cloudfront/css/mo/default.css.
Retains source declarations and class names; prefixes selectors with
#phone .zb-faithful so global original CSS cannot overwrite HITEL app styles.
"""
import re,urllib.request,hashlib
from pathlib import Path
import tinycss2
URL='https://m.zocbo.com/cloudfront/css/mo/default.css?ts=20261106152501'
r=urllib.request.Request(URL,headers={'User-Agent':'Mozilla/5.0','Accept':'text/css,*/*'})
with urllib.request.urlopen(r,timeout=25) as f:source=f.read()
txt=source.decode('utf-8','replace')
TERMS=('.zbAccordion','.zbContainer','.zbFilter','.lnb__','.tabLineRound','.tabLine-round',
 '.download','.episode__','.grouping__','.bottomSheet','.check__',
 '.badge','.productSelect','.bbsList','.bbsNumber','.listTop','#examMain')
def accepted(sel):return any(t in sel for t in TERMS)
def prefix(s):
 # Original is a flat CSS stylesheet, selectors may contain comma-separated lists.
 parts=[x.strip() for x in s.split(',')]
 parts=[x for x in parts if accepted(x) and not x.startswith(('@font-face',':root'))]
 return ','.join('#phone .zb-faithful '+x for x in parts)
def collect(nodes):
 out=[]
 for rule in nodes:
  if rule.type=='qualified-rule':
   selector=tinycss2.serialize(rule.prelude).strip()
   scoped=prefix(selector)
   if scoped:
    body=tinycss2.serialize(rule.content)
    body=re.sub(r'url\(\s*([\"\\']?)(/[^)\"\\']+)\1\s*\)',lambda m:'url("https://m.zocbo.com'+m.group(2)+'")',body)
    out.append(scoped+'{'+body+'}')
  elif rule.type=='at-rule' and rule.lower_at_keyword in ('media','supports') and rule.content:
   child=collect(tinycss2.parse_rule_list(rule.content,skip_comments=True,skip_whitespace=True))
   if child:out.append('@'+rule.lower_at_keyword+' '+tinycss2.serialize(rule.prelude)+'{'+'\n'.join(child)+'}')
 return out
rules=tinycss2.parse_stylesheet(txt,skip_whitespace=True,skip_comments=True)
extracted=collect(rules)
path=Path('public/zocbo-captured-original.css')
head=f'/* Original public mobile CSS declarations; URL {URL}; sha256={hashlib.sha256(source).hexdigest()}; scoped to HITEL sector. */\n'
path.write_text(head+'\n'.join(extracted),encoding='utf8')
print('ORIGINAL_CSS_CAPTURED',len(source),'bytes',len(extracted),'scoped blocks',path.stat().st_size,'bytes output',flush=True)
if len(extracted)<35:raise SystemExit('Insufficient original mobile CSS rule capture')
