#!/usr/bin/env python3
import urllib.request,urllib.parse,re,concurrent.futures,json,html
targets=[
("middle_root","001001049"),("high_root","001001050"),
("middle_subject_social1","001001049002005"),("middle_subject_korean1","001001049002001"),
("high_subject_math","001001050002"),("high_subject_science","001001050005")
]
def f(item):
 name,id=item
 url="https://www.yes24.com/product/category/display/"+id
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36"})
  with urllib.request.urlopen(req,timeout=12) as r:b=r.read(1300000).decode("utf-8","replace");status=r.status
  mids=set(re.findall(r"001001049\d{0,12}(?!\d)",b))
  highs=set(re.findall(r"001001050\d{0,12}(?!\d)",b))
  links=re.findall(r'href=["\']([^"\']+(?:category/display|Category/Display)[^"\']+)["\']',b,re.I)
  prodIDs=set(re.findall(r"/product/goods/(\d+)",b,re.I))
  scripts=re.findall(r".{0,90}(?:00100104900200[0-9]|PageNumber|pageNumber).{0,95}",b,re.I)
  return {"name":name,"id":id,"status":status,"raw_mid_category_ids":sorted(mids)[:140],
   "raw_high_category_ids":sorted(highs)[:140],"mid_count":len(mids),"high_count":len(highs),
   "category_links":links[:35],"product_count":len(prodIDs),"page_samples":scripts[:7]}
 except Exception as e:return {"name":name,"error":repr(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for result in pool.map(f,targets):print("YES24_ID_PROBE",json.dumps(result,ensure_ascii=False),flush=True)
