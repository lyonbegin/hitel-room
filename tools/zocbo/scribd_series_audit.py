#!/usr/bin/env python3
"""Title-first Scribd audit for 33 Korean math workbook series.

Stage 1: search the broad book-family keyword with no school-level/term filter.
Stage 2: preserve ALL accessible result titles + URLs + IDs, dedup globally.
Stage 3: classify the acquired titles into middle/high/unknown, series, grades,
         term, curriculum edition, and document type.
No textbook file downloading, CAPTCHA solving, or access restriction bypass.
A blocked/incomplete search is always reported as blocked/incomplete, never 0.
"""
from __future__ import annotations
import csv
import json
import os
import re
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright

OUT=Path("scribd-title-audit")
OUT.mkdir(parents=True,exist_ok=True)

SERIES=[
 ("베이직쎈","베이직쎈"),
 ("개념쎈","개념쎈"),
 ("쎈 개념 연산","쎈"),
 ("라이트쎈","라이트쎈"),
 ("쎈 중등 수학","쎈"),
 ("쎈B","쎈"),
 ("우공비Q+Q 기본실전","우공비Q+Q"),
 ("우공비Q+Q 표준완성","우공비Q+Q"),
 ("우공비Q+Q 발전심화","우공비Q+Q"),
 ("일품 중등 수학","일품"),
 ("개념원리 중학 수학","개념원리"),
 ("개념원리 RPM","개념원리"),
 ("교과서 개념잡기","교과서 개념잡기"),
 ("개념플러스유형 라이트","개념플러스유형"),
 ("개념플러스유형 파워","개념플러스유형"),
 ("체크체크 베이직","체크체크"),
 ("체크체크 베이직 N제","체크체크"),
 ("체크체크 중학 수학","체크체크"),
 ("체크체크 유형체크 N제","체크체크"),
 ("최상위수학 라이트","최상위수학"),
 ("최상위수학","최상위수학"),
 ("풍산자 개념완성","풍산자"),
 ("풍산자 반복수학","풍산자"),
 ("풍산자 테스트북","풍산자"),
 ("수력충전","수력충전"),
 ("블랙라벨 중학 수학","블랙라벨 수학"),
 ("에이급 원리해설","에이급"),
 ("에이급 수학","에이급"),
 ("에이급 수학의 단비","에이급"),
 ("급속충전 에이급수학","에이급"),
 ("숨마쿰라우데 스타트업","숨마쿰라우데"),
 ("숨마쿰라우데 개념기본서","숨마쿰라우데"),
 ("숨마쿰라우데 실전문제집","숨마쿰라우데"),
]
assert len(SERIES)==33

# 33 workbook families are represented in the manifest. Identical broad search
# keywords are crawled once; every source hit is mapped back to all plausible
# families, and exact series attribution is only marked when verified by title.
ROOTS=list(dict.fromkeys(root for _,root in SERIES))
def url(q):return "https://www.scribd.com/search?"+urlencode({"query":q,"verbatim":"true"})
def compact(s,n=300):return re.sub(r"\s+"," ",s or "").strip()[:n]
def safe(q):return hashlib.sha1(q.encode()).hexdigest()[:12]
def write_csv(path,rows,cols):
    with path.open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=cols,extrasaction="ignore")
        w.writeheader()
        for r in rows:w.writerow(r)

def classify(title):
    s=title.replace("\n"," ")
    middle=bool(re.search(r"중등|중학|중학교|중[123](?!\d)",s))
    high=bool(re.search(r"고등|고교|고등학교|고[123](?!\d)|공통\s*수학|미적분\s*[ⅠⅡ12]|확률과\s*통계|수학\s*[ⅠⅡ](?!\w)|수학\s*\([상하]\)",s))
    level=("중·고 혼합" if middle and high else
           "중학" if middle else "고등" if high else "학제 미확인")
    term=""
    if level=="중학":
        m=re.search(r"(?:중등|중학|중)\s*([123])\s*[-－–]\s*([12])",s)
        if m:term=m.group(1)+"-"+m.group(2)
    edition=(
        "2022 개정" if re.search("2022\s*개정|22\s*개정",s) else
        "2015 개정" if re.search("2015\s*개정|15\s*개정",s) else
        "판본 미확인")
    if re.search(r"정오표|오탈자|정정",s):doctype="정오표"
    elif re.search(r"정답|해설|답지|해답|풀이",s):doctype="해설·정답"
    elif re.search(r"교사용|지도서|교사용",s):doctype="교사용"
    elif re.search(r"일부|발췌|파트|특강|단원|워크북|부록|테스트",s,re.I):doctype="부분·부록 가능성"
    else:doctype="본문 여부 미검증"
    return {"학교급":level,"학기":term,"판본":edition,"자료유형":doctype}
def visible_docs(page):
    return page.evaluate(r"""() => Array.from(document.querySelectorAll('a[href*="/document/"]'))
      .map(a=>{
        const m=a.href.match(/\/document\/(\d+)(?:\/|$|\?)/);
        if(!m)return null;
        const wrap=a.closest('article,li,[data-testid]')||a.parentElement;
        const t=(a.innerText||a.getAttribute('aria-label')||
                 a.getAttribute('title')||wrap?.innerText||"").replace(/\s+/g," ").trim();
        return {document_id:m[1],url:a.href.split("?")[0],
                title:t.slice(0,400),
                listing_excerpt:(wrap?.innerText||"").replace(/\s+/g," ").trim().slice(0,500)};
      }).filter(Boolean)""")
def crawl_one(browser,q):
    context=browser.new_context(locale="ko-KR",viewport={"width":1280,"height":900})
    page=context.new_page()
    info={"query":q,"search_url":url(q),"status":"미실행",
          "http_status":None,"displayed_count":None,"found_unique":None,
          "completeness":"미검증","documents":[],"errors":[],"scrolls":0}
    try:
        response=page.goto(url(q),wait_until="domcontentloaded",timeout=30000)
        page.wait_for_timeout(1300)
        info["http_status"]=response.status if response else None
        body=page.locator("body").inner_text(timeout=9000)
        info["page_title"]=page.title()
        info["body_excerpt"]=compact(body,500)
        if re.search("Client Challenge|CAPTCHA|Enter the characters seen|Verify you are human|Access Denied",page.title()+" "+body[:2000],re.I):
            info["status"]="CAPTCHA 차단"
            info["errors"].append("Scribd presented a challenge, so result count and document list were not readable")
            print("BLOCKED",q,info["http_status"],repr(info["body_excerpt"][:130]),flush=True)
            return info
        count=re.search(r"([\d,]+)\s*(?:results?|documents?|검색결과|개의 문서|건의 문서)",body[:7000],re.I)
        if count:info["displayed_count"]=count.group(1)
        docs={}
        stagnant=0
        for n in range(55):
            added=0
            for d in visible_docs(page):
                id=d["document_id"]
                if id not in docs:
                    docs[id]=d;added+=1
                elif len(d["title"])>len(docs[id]["title"]):
                    docs[id]=d
            info["scrolls"]+=1
            if not added:stagnant+=1
            else:stagnant=0
            more=page.get_by_role("button",name=re.compile("더 보기|더보기|show more|load more",re.I))
            try:
                if more.count() and more.first.is_visible(timeout=500):more.first.click(timeout=1200)
            except Exception:pass
            page.evaluate("window.scrollBy(0,Math.max(window.innerHeight*3,1400))")
            page.wait_for_timeout(600)
            if stagnant>=10:break
        # Keep raw titles, not just those classified as middle-school.
        info["documents"]=list(docs.values())
        info["found_unique"]=len(docs)
        info["status"]="접근 성공" if docs else "검색 화면에 문서 링크 없음"
        info["completeness"]="페이지네이션 및 전체 결과 총수 대조 필요"
        print("CRAWLED",q,"hits",len(docs),"stated",info["displayed_count"],flush=True)
    except Exception as exc:
        info["status"]="접근 오류"
        info["errors"].append(str(exc)[:400])
        print("ERROR",q,repr(str(exc)[:180]),flush=True)
    finally:
        context.close()
    return info

def main():
    manifest=[{"번호":i+1,"기존 중학교 시리즈":s,"폭넓은 원본 검색어":q,"검색 URL":url(q)}
              for i,(s,q) in enumerate(SERIES)]
    write_csv(OUT/"33series_query_manifest.csv",manifest,
              ["번호","기존 중학교 시리즈","폭넓은 원본 검색어","검색 URL"])
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        for q in ROOTS:
            r=crawl_one(browser,q)
            results.append(r)
            (OUT/f"raw_{safe(q)}.json").write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding="utf-8")
        browser.close()
    by_id={}
    for r in results:
        for d in r["documents"]:
            id=d["document_id"]
            entry=by_id.setdefault(id,{**d,"검색어목록":[]})
            if r["query"] not in entry["검색어목록"]:entry["검색어목록"].append(r["query"])
            if len(d["title"])>len(entry["title"]):
                entry["title"]=d["title"]
    classified=[]
    for d in sorted(by_id.values(),key=lambda x:x["document_id"]):
        # Do not assume that broad search hits belong to every series using
        # that root keyword. Keep attribution '검토 필요' until title verified.
        classified.append({
          "document_id":d["document_id"],"제목":compact(d["title"],400),
          **classify(d["title"]),
          "검색어목록":" | ".join(d["검색어목록"]),
          "시리즈확정":"제목·본문 대조 필요",
          "Scribd URL":d["url"],
          "원본 검색 설명":compact(d.get("listing_excerpt",""),500),
          "원본 완전성":"검증 안 됨"})
    write_csv(OUT/"all_raw_document_links.csv",
              [{"document_id":d["document_id"],"title":d["title"],"URL":d["url"],
                "root_search_terms":" | ".join(d["검색어목록"])}
               for d in by_id.values()],
              ["document_id","title","URL","root_search_terms"])
    write_csv(OUT/"classified_middle_high_unknown.csv",classified,[
        "document_id","제목","학교급","학기","판본","자료유형","검색어목록",
        "시리즈확정","Scribd URL","원본 검색 설명","원본 완전성"])
    searches=[{
        "기본 검색어":r["query"],"Scribd 검색 URL":r["search_url"],
        "상태":r["status"],"화면 표시 검색 결과 수":r["displayed_count"] or "미확인",
        "읽어온 문서 ID 수":r["found_unique"] if r["found_unique"] is not None else "미확인",
        "전수확보 여부":r["completeness"],
        "차단 또는 오류":" | ".join(r["errors"])
    } for r in results]
    write_csv(OUT/"broad_query_status.csv",searches,
              ["기본 검색어","Scribd 검색 URL","상태","화면 표시 검색 결과 수",
               "읽어온 문서 ID 수","전수확보 여부","차단 또는 오류"])
    from collections import Counter
    counts=Counter(x["학교급"] for x in classified)
    report={
      "date":datetime.now(timezone.utc).isoformat(),
      "scope":"33 named middle-school series, unfiltered broad search in both middle and high school",
      "series_count":len(SERIES),"distinct_root_queries":len(ROOTS),
      "searches_successful":sum(x["status"]=="접근 성공" for x in results),
      "searches_blocked":sum(x["status"]=="CAPTCHA 차단" for x in results),
      "unique_document_ids_read":len(by_id),
      "classified_levels":dict(counts),
      "all_results_exhaustively_enumerated":False,
      "warning":"blocked search is not zero results; search counts are not books; linked documents may be partial or copyrighted",
      "search_states":searches}
    (OUT/"summary.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print("AUDIT_SUMMARY",json.dumps({k:v for k,v in report.items() if k not in ("search_states",)},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
