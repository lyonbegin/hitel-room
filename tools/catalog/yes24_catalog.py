#!/usr/bin/env python3
"""HITEL middle/high all-subject YES24 reference-book CATEGORY crawler.

The native YAES24 category HTML yields actual book names + direct goods URLs.
This complements (not replaces) broad title-first search and Scribd indexing.
Only publicly listed book metadata is retained; never downloads textbook content.
Category links are discovered recursively from the genuine site; NOT invented.
Page-2 requests are accepted ONLY when they return new IDs (avoid false paging).

Run with:
  MAX_CATEGORY_VISITS=240 MAX_PER_CATEGORY_PAGES=2
  python tools/catalog/yes24_catalog.py
"""
from __future__ import annotations
import os, re, csv, time, json, html, urllib.request, urllib.error
from pathlib import Path
from collections import deque, Counter
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit
from bs4 import BeautifulSoup
from collect_books import OUT, classify, compact, write_csv

ROOTS={
    "001001049": "중등",
    "001001050": "고등",
    # Verified real intermediate YES24 category pages reveal the hidden
    # middle-school subject/grade tree, which the root landing page omits.
    "001001049002001": "중등",  # 국어(중등1)
    "001001049002005": "중등",  # 사회/역사(중등1)
}
BASE="https://www.yes24.com/product/category/display/"
MAX_VISITS=max(2,int(os.getenv("MAX_CATEGORY_VISITS","200")))
MAX_PAGES=max(1,min(8,int(os.getenv("MAX_PER_CATEGORY_PAGES","5"))))
REQUEST_INTERVAL=0.21
CATEGORY_RE=re.compile(r"/(?:product|24)/category/display/(\d{9,20})(?:\b|[/?#])",re.I)
PRODUCT_RE=re.compile(r"/(?:product/goods|goods/detail)/(\d+)(?:$|[/?#])",re.I)
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def fetch(url):
    request=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.9","Accept":"text/html,*/*"})
    try:
        with urllib.request.urlopen(request,timeout=18) as resp:
            content=resp.read(1800000)
            # Prefer response header or page meta, default UTF-8. YES24 has EUC-KR pages.
            enc=resp.headers.get_content_charset() or ""
            head=content[:6000].decode("ascii","ignore")
            mm=re.search(r"charset\s*=\s*[\"']?([\w-]+)",head,re.I)
            if mm:enc=mm.group(1)
            if not enc:enc="utf-8"
            try:body=content.decode(enc,"replace")
            except LookupError:body=content.decode("utf-8","replace")
            return body,resp.geturl(),resp.status,""
    except Exception as exc:
        return "","",0,repr(exc)[:250]
def category_links(soup,level):
    result={}
    for a in soup.find_all("a",href=True):
        m=CATEGORY_RE.search(a["href"])
        if not m:continue
        cid=m.group(1)
        if not cid.startswith(level):continue
        # Ignore unrelated navigation links outside relevant category root.
        title=compact(a.get_text(" ",strip=True),140)
        if cid not in result or len(title)>len(result[cid]):result[cid]=title
    return result
def product_links(soup):
    result={}
    # Strong evidence = card's title anchor, not advertisements or review links.
    candidates=soup.select("a.gd_name[href], a.lnk_item[href], a[href*='/product/goods/'], a[href*='/Product/Goods/']")
    for a in candidates:
        raw=a.get("href","")
        m=PRODUCT_RE.search(urlsplit(urljoin(BASE,raw)).path)
        if not m:continue
        id=m.group(1)
        name=compact(a.get_text(" ",strip=True),310)
        if not name or name in ("미리보기","새창이동","리뷰","회원리뷰","상품정보"):continue
        # Prefer gd_name title anchor, otherwise the longest descriptive anchor.
        priority=100 if "gd_name" in a.get("class",[]) else 20
        value={"yes24_id":id,"book_title":name,"direct_book_url":"https://www.yes24.com/product/goods/"+id,"priority":priority}
        old=result.get(id)
        if old is None or priority>old["priority"] or (priority==old["priority"] and len(name)>len(old["book_title"])):
            result[id]=value
    return list(result.values())
def category_page_url(cid,page):
    # Use the existing category URL; the site's page-number parameter can be
    # ignored by the server, which we check by comparing returned product IDs.
    return BASE+cid+(("?page="+str(page)) if page>1 else "")
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    queue=deque(ROOTS.keys())
    seen=set()
    categories={cid:{"category_id":cid,"category_name":label+"참고서",
                     "level":label,"discovered_from":"seed"}
                for cid,label in ROOTS.items()}
    books={}
    visits=[]
    failures=[]
    while queue and len(seen)<MAX_VISITS:
        cid=queue.popleft()
        if cid in seen:continue
        seen.add(cid)
        level="중등" if cid.startswith("001001049") else "고등" if cid.startswith("001001050") else "미분류"
        first_ids=set()
        for page_num in range(1,MAX_PAGES+1):
            url=category_page_url(cid,page_num)
            data,final,status,err=fetch(url)
            if status!=200 or "/main/default" in final.lower() or not data:
                failures.append({"category_id":cid,"page":page_num,"url":url,"status":status,"final":final,"error":err})
                if page_num==1:print("CATEGORY_FAILURE",cid,status,err[:90],flush=True)
                break
            soup=BeautifulSoup(data,"html.parser")
            discovered=category_links(soup,cid[:9])
            for child,childname in discovered.items():
                if child==cid:continue
                if child not in categories:
                    categories[child]={"category_id":child,"category_name":childname,
                                       "level":level,"discovered_from":cid}
                    queue.append(child)
                elif len(childname)>len(categories[child]["category_name"]):
                    categories[child]["category_name"]=childname
            products=product_links(soup)
            ids={p["yes24_id"] for p in products}
            if page_num==2 and ids==first_ids:
                visits.append({"category_id":cid,"level":level,"page":page_num,
                                "page_url":final,"products":len(products),"new_ids":0,
                                "status":"pagination returned same IDs; stopped"})
                break
            if page_num==1:first_ids=ids
            added=0
            for p in products:
                id=p["yes24_id"]
                entry=books.get(id)
                if entry is None:
                    entry=p
                    entry["from_category_ids"]=[]
                    entry["from_category_names"]=[]
                    entry["source_pages"]=[]
                    books[id]=entry
                    added+=1
                if cid not in entry["from_category_ids"]:
                    entry["from_category_ids"].append(cid)
                    entry["from_category_names"].append(categories[cid]["category_name"])
                if final not in entry["source_pages"]:entry["source_pages"].append(final)
            visits.append({"category_id":cid,"level":level,"page":page_num,
                           "page_url":final,"products":len(products),"new_ids":added,
                           "status":"read and parsed"})
            print("YES24_CATEGORY",len(seen),"/",MAX_VISITS,"category",cid,
                  "children",len(discovered),"page",page_num,
                  "product_titles",len(products),"new",added,"total",len(books),flush=True)
            if not products:break
            time.sleep(REQUEST_INTERVAL)
        if len(seen)%25==0:
            print("PROGRESS",len(seen),"categories",len(categories),"books",len(books),flush=True)
    # Classification: first rely on verified catalogue category, then parse book
    # title for subject/grade/semester; leave unresolved classification explicit.
    rows=[]
    for v in books.values():
        hints=classify(v["book_title"])
        levels=set("중등" if cid.startswith("001001049") else "고등"
                   for cid in v["from_category_ids"])
        actual=("복합" if len(levels)>1 else next(iter(levels)) if levels else hints["학교급"])
        if hints["학교급"] in ("중등","고등") and hints["학교급"]!=actual:
            school="교차 분류 확인 필요"
        else:school=actual
        names=" | ".join(v["from_category_names"])
        subject=hints["과목"]
        if subject=="미분류":
            for candidate in ("국어","영어","수학","과학","사회","역사","도덕","기술가정","정보","한문","일본어","중국어","음악","미술","체육"):
                if candidate in names:
                    subject=("제2외국어" if candidate in ("일본어","중국어") else candidate)
                    break
        rows.append({
          "yes24_id":v["yes24_id"],"교재명":v["book_title"],
          "학교급":school,"학년":hints["학년"],"학기":hints["학기"],
          "과목":subject,"개정판":hints["개정판"],"자료형태":hints["자료형태"],
          "실제 상세페이지":v["direct_book_url"],
          "수집 카테고리 ID":" | ".join(v["from_category_ids"]),
          "수집 카테고리명":names,
          "원본 카테고리 페이지":" | ".join(v["source_pages"]),
          "검증":"예스24 실제 카테고리 HTML의 책 제목·제품 ID 확인; ISBN/판본 전체성 미검증",
        })
    rows.sort(key=lambda r:(r["학교급"],r["과목"],r["교재명"],r["yes24_id"]))
    columns=["yes24_id","교재명","학교급","학년","학기","과목","개정판","자료형태",
             "실제 상세페이지","수집 카테고리 ID","수집 카테고리명","원본 카테고리 페이지","검증"]
    write_csv("yes24_book_detail_links.csv",rows,columns)
    write_csv("yes24_categories.csv",list(categories.values()),
              ["category_id","category_name","level","discovered_from"])
    write_csv("yes24_category_pages_audit.csv",visits,
              ["category_id","level","page","page_url","products","new_ids","status"])
    write_csv("yes24_fetch_failures.csv",failures,
              ["category_id","page","url","status","final","error"])
    summary={
      "generated_at_utc":datetime.now(timezone.utc).isoformat(),
      "catalog_source":"YES24 public category listing HTML, direct /product/goods/{id} URL",
      "root_category_urls":[BASE+cid for cid in ROOTS],
      "categories_discovered":len(categories),
      "categories_visited":len(seen),
      "categories_unvisited":len(categories)-len(seen),
      "category_pages_read":len(visits),
      "unique_book_detail_urls":len(rows),
      "by_school_level":dict(Counter(row["학교급"] for row in rows)),
      "by_subject":dict(Counter(row["과목"] for row in rows)),
      "fetch_failures":len(failures),
      "all_books_exhaustively_collected":False,
      "reason_incomplete":"Only visible category HTML; unvisited children/pagination, older editions, sold-out books, and other stores may have more titles.",
      "book_page_links_provenance":"Direct book detail IDs extracted from original YES24 category page; not fabricated URLs.",
      "extra_detail_fields_pending":"ISBN and publisher enrichments require direct product page inspection."
    }
    (OUT/"yes24_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print("YES24_CATALOG_SUMMARY",json.dumps(summary,ensure_ascii=False),flush=True)
    for r in rows[:35]:
        print("YES24_BOOK_LINK",r["학교급"],r["과목"],r["교재명"][:85],r["실제 상세페이지"],flush=True)
if __name__=="__main__":main()
