#!/usr/bin/env python3
import urllib.request,urllib.parse,html,re,json,concurrent.futures
q="쎈 중등 수학"
paths=[
 "https://www.yes24.com/Product/Search?domain=ALL&query="+urllib.parse.quote(q),
 "https://www.yes24.com/product/search?domain=ALL&query="+urllib.parse.quote(q),
 "https://www.yes24.com/Product/Search?domain=ALL&query="+urllib.parse.quote(urllib.parse.quote(q)),
 "https://www.yes24.com/product/search?domain=ALL&query="+urllib.parse.quote(urllib.parse.quote(q)),
 "https://www.yes24.com/Product/Search?query="+urllib.parse.quote(urllib.parse.quote(q)),
 "https://m.yes24.com/search?query="+urllib.parse.quote(urllib.parse.quote(q)),
 "https://www.yes24.com/product/category/display/001001049002005",
 "https://m.yes24.com/home/new?dispNo=001001049002005&tab=1",
]
def f(url):
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36","Accept-Language":"ko-KR,ko;q=0.9"})
  with urllib.request.urlopen(req,timeout=15) as resp:
   data=resp.read(950000).decode("utf-8","replace")
   final=resp.geturl()
  docids=list(dict.fromkeys(re.findall(r"(?:/Product/Goods/|/product/goods/|/goods/detail/)(\d+)",data,re.I)))
  score=sum(x in data for x in ["쎈","중등","수학"])
  txt=re.sub(r"<[^>]+>"," ",data);txt=html.unescape(re.sub(r"\s+"," ",txt))
  windows=[]
  for mid in list(re.finditer(r"(?:/Product/Goods/|/product/goods/|/goods/detail/)\d+",data,re.I))[:6]:
   windows.append(re.sub(r"\s+"," ",data[max(0,mid.start()-100):mid.end()+150])[:300])
  return {"requested":url,"final":final,"count":len(docids),"sample_ids":docids[:15],
   "book_terms":score,"content_title":re.findall(r"<title[^>]*>(.*?)</title>",data,re.I|re.S)[:1],
   "snippet":txt[:400],"link_windows":windows}
 except Exception as ex:return {"requested":url,"error":repr(ex)}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for result in pool.map(f,paths):
  print("YES24_FORMAT",json.dumps(result,ensure_ascii=False)[:3400],flush=True)
