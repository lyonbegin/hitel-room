#!/usr/bin/env python3
"""Index-based Scribd document URL collector (broad search, middle+high).

Enumerates publicly indexed Scribd /document/<id> detail page URLs from search
engine results using broad book-family keywords. Keeps raw result title + URL,
then classifies; never assumes that a blocked search means zero books. It does
not download books, reproduce textbook pages, bypass CAPTCHA, or assert that
search engine listings are complete.
"""
import csv, html, json, re, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from scribd_series_audit import OUT, ROOTS, SERIES, classify, compact, write_csv

HEADERS={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
         "Accept-Language":"ko-KR,ko;q=0.9,en;q=0.7"}
DOC_RE=re.compile(r"https?://(?:www\.)?scribd\.com/document/(\d+)(?:/[^'\"<>\s]*)?",re.I)
SEEDS=[
 ("블랙라벨 수학","726283793","블랙라벨 수학 (상)","web-index-verified"),
 ("풍산자","1024768392","풍산자 공통수학1","web-index-verified"),
 ("쎈","929830551","쎈B 공통수학2","web-index-verified"),
 ("숨마쿰라우데","1016862706","숨마쿰라우데 공통수학1 학생용","web-index-verified"),
 ("라이트쎈","1045496147","라이트쎈 중등 수학 1-2 본문","web-index-verified"),
 ("수력충전","888399509","수력충전 중등 수학 1-1 문제","web-index-verified"),
 ("수력충전","852942023","수력충전 중등 수학 2 상","web-index-verified"),
 ("우공비Q+Q","896301784","우공비Q+Q 3-1 기본편 답지","web-index-verified"),
 ("쎈","1033493368","쎈 중등 수학 1-2 정오표","web-index-verified"),
 ("숨마쿰라우데","1002258026","숨마쿰라우데 공통수학1 미리보기","web-index-verified"),
]
def fetch(url):
    try:
        req=urllib.request.Request(url,headers=HEADERS)
        with urllib.request.urlopen(req,timeout=12) as resp:
            return resp.status,resp.read(600000).decode("utf-8","replace"),resp.geturl(),""
    except Exception as exc:return 0,"",url,str(exc)[:170]

def canonical(raw):
    raw=html.unescape(raw or "")
    if "uddg=" in raw:
        try:
            q=urllib.parse.parse_qs(urllib.parse.urlparse(raw).query)
            raw=q.get("uddg",[raw])[0]
        except Exception:pass
    raw=urllib.parse.unquote(raw)
    m=DOC_RE.search(raw)
    if not m:return "",""
    return m.group(1),"https://www.scribd.com/document/"+m.group(1)

def untag(x):
    return compact(html.unescape(re.sub(r"<[^>]+>"," ",x or "")),350)

def bing_rss(root,offset):
    query='site:scribd.com/document "'+root+'"'
    url="https://www.bing.com/search?"+urllib.parse.urlencode({"q":query,"format":"rss","first":offset})
    status,body,end,err=fetch(url)
    hits=[]
    if status==200 and "<rss" in body.lower():
        try:
            xml=ET.fromstring(body)
            for item in xml.findall(".//item"):
                id,link=canonical(item.findtext("link",""))
                if not id:continue
                hits.append({"document_id":id,"url":link,
                             "title":compact(item.findtext("title","")),
                             "snippet":untag(item.findtext("description","")),
                             "root":root,"index_source":"Bing RSS","search_url":url})
        except Exception as exc:err="XML parse: "+str(exc)[:130]
    elif not err:err="Not RSS: "+compact(body[:120])
    return {"root":root,"search_url":url,"engine":"Bing RSS","status":status,"hits":hits,"error":err}

class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.active=None;self.buf=[]
    def handle_starttag(self,tag,attrs):
        if tag!="a":return
        d=dict(attrs)
        self.active=d.get("href","")
        self.buf=[]
    def handle_data(self,data):
        if self.active is not None:self.buf.append(data)
    def handle_endtag(self,tag):
        if tag=="a" and self.active is not None:
            self.links.append((self.active,compact(" ".join(self.buf),300)))
            self.active=None;self.buf=[]

def ddg_html(root,offset):
    query='site:scribd.com/document "'+root+'"'
    url="https://html.duckduckgo.com/html/?"+urllib.parse.urlencode({"q":query,"s":offset})
    status,body,end,err=fetch(url)
    hits=[]
    if status==200 and "<html" in body.lower():
        try:
            parser=AnchorParser();parser.feed(body)
            for raw,title in parser.links:
                id,link=canonical(raw)
                if not id:continue
                hits.append({"document_id":id,"url":link,"title":title,
                             "snippet":"","root":root,"index_source":"DuckDuckGo HTML",
                             "search_url":url})
        except Exception as exc:err="HTML parse: "+str(exc)[:120]
    elif not err:err="No HTML: "+compact(body[:120])
    return {"root":root,"search_url":url,"engine":"DuckDuckGo HTML","status":status,"hits":hits,"error":err}

def google_html(root,offset):
    query='site:scribd.com/document "'+root+'"'
    url="https://www.google.com/search?"+urllib.parse.urlencode({"q":query,"num":20,"start":offset})
    status,body,end,err=fetch(url)
    hits=[]
    if status==200:
        # Indexed link URLs only. Raw HTML snippets are not reliable enough to
        # infer a textbook title, so leave title blank unless link text is parsed.
        parser=AnchorParser()
        try:parser.feed(body)
        except Exception:pass
        for raw,title in parser.links:
            id,link=canonical(raw)
            if not id:continue
            hits.append({"document_id":id,"url":link,"title":title,"snippet":"",
                         "root":root,"index_source":"Google HTML","search_url":url})
    return {"root":root,"search_url":url,"engine":"Google HTML","status":status,"hits":hits,"error":err}

def detail_metadata(d):
    status,body,end,err=fetch(d["URL"])
    page_title=""
    if body:
        mm=re.search(r"<title[^>]*>(.*?)</title>",body,re.S|re.I)
        if mm:page_title=untag(mm.group(1))
        if "captcha" in body[:15000].lower() or "client challenge" in page_title.lower():
            return d["document_id"],{"detail_http":status,"detail_state":"CAPTCHA","detail_title":"","detail_error":"Challenge presented"}
    if status==200:
        og=re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',body,re.I)
        if og:page_title=html.unescape(og.group(1))
    state="접근 가능" if status==200 and page_title else "직접 접근 제한/제목 미확인"
    return d["document_id"],{"detail_http":status,"detail_state":state,
                             "detail_title":compact(page_title,300),"detail_error":err}

def main():
    OUT.mkdir(exist_ok=True)
    records=[]
    with ThreadPoolExecutor(max_workers=8) as pool:
        tasks=[]
        for root in ROOTS:
            tasks.extend([pool.submit(bing_rss,root,1),
                          pool.submit(bing_rss,root,11),
                          pool.submit(ddg_html,root,0),
                          pool.submit(google_html,root,0)])
        for idx,future in enumerate(as_completed(tasks),1):
            r=future.result();records.append(r)
            print("INDEX_QUERY",idx,"of",len(tasks),r["root"],r["engine"],
                  "http",r["status"],"links",len(r["hits"]),
                  "error",r["error"][:75],flush=True)
    by_id={}
    for r in records:
        for hit in r["hits"]:
            id=hit["document_id"]
            entry=by_id.setdefault(id,{"document_id":id,"URL":hit["url"],
                                       "title":"","sources":set(),"root_terms":set(),
                                       "search_urls":set()})
            if len(hit["title"])>len(entry["title"]):entry["title"]=hit["title"]
            entry["sources"].add(hit["index_source"])
            entry["root_terms"].add(hit["root"])
            entry["search_urls"].add(hit["search_url"])
    seed_ids=[]
    for root,id,title,source in SEEDS:
        seed_ids.append(id)
        entry=by_id.setdefault(id,{"document_id":id,"URL":"https://www.scribd.com/document/"+id,
                                   "title":"","sources":set(),"root_terms":set(),"search_urls":set()})
        if not entry["title"] or len(title)>len(entry["title"]):
            entry["title"]=title
        entry["sources"].add(source);entry["root_terms"].add(root)
    docs=list(by_id.values())
    print("DOCUMENT_LINKS_AFTER_DEDUP",len(docs), "index_found",len(docs)-len(set(seed_ids)),flush=True)
    # Verify only page metadata; no PDF downloads or textbook body retention.
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures=[pool.submit(detail_metadata,d) for d in docs[:150]]
        details=dict(f.result() for f in as_completed(futures))
    for d in docs:
        d.update(details.get(d["document_id"],{"detail_http":None,
                        "detail_state":"직접 확인 범위 밖","detail_title":"","detail_error":""}))
        title=d["detail_title"] if d["detail_state"]=="접근 가능" else d["title"]
        d["classify_title"]=title
        d.update(classify(title))
        d["root_terms"]=" | ".join(sorted(d["root_terms"]))
        d["sources"]=" | ".join(sorted(d["sources"]))
        d["search_urls"]=" | ".join(sorted(d["search_urls"]))
    documents=sorted(docs,key=lambda x:(x["학교급"],x["root_terms"],x["document_id"]))
    write_csv(OUT/"document_detail_links.csv",[
        {"document_id":d["document_id"],"상세페이지 URL":d["URL"],
         "검색결과 제목":d["title"],"직접 페이지 제목":d["detail_title"],
         "상세페이지 상태":d["detail_state"],"상세페이지 HTTP":d["detail_http"],
         "학교급":d["학교급"],"학기":d["학기"],"판본":d["판본"],
         "자료유형":d["자료유형"],"기본검색어":d["root_terms"],
         "검색엔진 출처":d["sources"],"원본 검색 URL":d["search_urls"],
         "확인단계":"직접 제목만 확인 / 본문 전체성 미검증"}
         for d in documents],
         ["document_id","상세페이지 URL","검색결과 제목","직접 페이지 제목",
          "상세페이지 상태","상세페이지 HTTP","학교급","학기","판본",
          "자료유형","기본검색어","검색엔진 출처","원본 검색 URL","확인단계"])
    write_csv(OUT/"search_queries_report.csv",[
      {"기본검색어":r["root"],"검색엔진":r["engine"],"검색 URL":r["search_url"],
       "HTTP":r["status"],"수집 링크 수":len(r["hits"]),"오류":r["error"]}
      for r in records],
      ["기본검색어","검색엔진","검색 URL","HTTP","수집 링크 수","오류"])
    summary={"date":datetime.now(timezone.utc).isoformat(),
             "33_series_total":len(SERIES),"base_search_keywords":len(ROOTS),
             "index_queries_attempted":len(records),
             "index_queries_returning_links":sum(bool(x["hits"]) for x in records),
             "deduplicated_document_detail_urls":len(documents),
             "seed_direct_links_from_verified_public_index":len(SEEDS),
             "classification_by_school_level":dict(Counter(d["학교급"] for d in docs)),
             "detail_page_states":dict(Counter(d["detail_state"] for d in docs)),
             "all_scribd_results_retrieved":False,
             "coverage_limit":"Search engines index only subsets, and Scribd public search returned CAPTCHA; totals cannot imply full Scribd coverage."}
    (OUT/"indexed_detail_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print("INDEX_DETAIL_SUMMARY",json.dumps(summary,ensure_ascii=False),flush=True)
    for d in documents[:45]:
        print("DETAIL_LINK",d["학교급"],d["document_id"],d["URL"],d["title"][:100],flush=True)
if __name__=="__main__":main()
