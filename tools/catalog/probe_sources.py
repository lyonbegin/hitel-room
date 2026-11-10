#!/usr/bin/env python3
"""Probe public Korean bookstore search result pages to choose working catalog source."""
import concurrent.futures, re, html, json, urllib.request, urllib.parse, urllib.error
q=urllib.parse.quote("쎈 중등 수학")
cases=[
 ("yes24_desktop","https://www.yes24.com/product/search?domain=ALL&query="+q),
 ("yes24_mobile","https://m.yes24.com/search?query="+q),
 ("yes24_category","https://www.yes24.com/product/category/display/001001013001"),
 ("yes24_known_product","https://www.yes24.com/product/goods/153914550"),
 ("aladin_search","https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord="+q),
 ("aladin_known","https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=341059441"),
 ("kyobo_search","https://search.kyobobook.co.kr/search?keyword="+q),
 ("interpark_search","https://book.interpark.com/search?query="+q),
 ("daum_book_search","https://search.daum.net/search?w=book&q="+q),
 ("naver_shopping_book","https://search.shopping.naver.com/book/search?query="+q),
 ("googlebooks","https://www.googleapis.com/books/v1/volumes?q="+q+"&maxResults=5"),
 ("google_book_nokey","https://www.google.com/search?q="+q+"+site%3Ayes24.com%2Fproduct%2Fgoods%2F"),
]
def probe(item):
    name,url=item
    try:
        request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36","Accept-Language":"ko-KR,ko;q=0.9","Accept":"text/html,application/json;q=0.8,*/*;q=0.5"})
        with urllib.request.urlopen(request,timeout=10) as response:
            body=response.read(900000).decode("utf-8","replace")
            status=response.status
            final=response.geturl()
        links=re.findall(r"(?:href\s*=\s*['\"]([^'\"]+)['\"])",body,re.I)
        booklinks=[]
        for l in links:
            if re.search(r"(?:/product/goods/|/Product/Goods/|/shop/wproduct\.aspx|/detail/|/product/)(?:\d+|[?])",l,re.I):
                if l not in booklinks:booklinks.append(l)
        name_tags=re.findall(r"<title[^>]*>(.*?)</title>",body,re.I|re.S)
        title=re.sub(r"\s+"," ",html.unescape(re.sub("<[^>]*>"," ",name_tags[0]))).strip()[:140] if name_tags else ""
        return {"source":name,"status":status,"bytes":len(body),"detail_url_count":len(booklinks),
             "detail_urls":booklinks[:9],"title":title,"final":final[:130],"error":"","snippet":re.sub(r"\s+"," ",body[:200]).strip()[:120]}
    except Exception as exc:
        return {"source":name,"status":0,"bytes":0,"detail_url_count":0,"detail_urls":[],"title":"","final":"","error":repr(exc)[:150],"snippet":""}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    results=list(ex.map(probe,cases))
for x in results:
    print("BOOKSTORE_PROBE",json.dumps(x,ensure_ascii=False),flush=True)
print("BOOKSTORE_SUCCESS_SUMMARY",json.dumps({"sources_with_product_links":[x["source"] for x in results if x["detail_url_count"]>0],
  "sources_accessible":[x["source"] for x in results if x["status"]==200]},ensure_ascii=False),flush=True)
