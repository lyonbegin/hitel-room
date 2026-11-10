#!/usr/bin/env python3
import urllib.request,urllib.parse,re,concurrent.futures,json,html
base="https://www.yes24.com/product/category/display/001001049002005"
args=["","?PageNumber=2","?pageNumber=2","?page=2","?Page=2","?pageNo=2","?PageNumber=3","?PageNumber=2&SortNo=02"]
def f(arg):
 url=base+arg
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36"})
  with urllib.request.urlopen(req,timeout=13) as r:
   body=r.read(850000).decode("utf-8","replace")
   final=r.geturl()
  # Only anchors with human-readable book title class gd_name
  a=re.findall(r'<a[^>]*class=["\'][^"\']*gd_name[^"\']*["\'][^>]*href=["\']([^"\']+)["\'][^>]*>([^<]+)',body,re.I|re.S)
  b=re.findall(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*class=["\'][^"\']*gd_name[^"\']*["\'][^>]*>([^<]+)',body,re.I|re.S)
  anchors=a+b
  result={"url":url,"final":final,"count":len(anchors),"first_titles":[html.unescape(y.strip())[:90] for x,y in anchors[:6]],
          "first_ids":[re.search(r'/(\d+)(?:$|\?)',x).group(1) if re.search(r'/(\d+)(?:$|\?)',x) else x for x,y in anchors[:6]],
          "page_html_snippets":re.findall(r'.{0,70}(?:PageNumber|fnChangePage|goPage|<div class="pagen").{0,95}',body,re.I)[:8]}
  return result
 except Exception as e:return {"url":url,"error":repr(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as p:
 for x in p.map(f,args):print("PAGINATION_PROBE",json.dumps(x,ensure_ascii=False)[:2400],flush=True)
