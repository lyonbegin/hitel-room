#!/usr/bin/env python3
"""HITEL all-subject Korean secondary workbook metadata catalog.

Collect BOOK TITLES + EXACT SOURCE DETAIL PAGE LINKS only (never textbook text).
1. Broad series-root searches first (middle + high unfiltered).
2. Additional curriculum/topic searches to discover omitted series.
3. Optional authenticated public search API finds Scribd document detail URLs.
4. Merge by stable source ID/ISBN; classify AFTER storing raw data.
5. Record coverage, provenance, blocked requests, and completeness honestly.

Google Books public list API needs no key. Brave Search optional: BRAVE_SEARCH_API_KEY
Google Custom Search optional: GOOGLE_CSE_KEY + GOOGLE_CSE_CX
Aladin optional: ALADIN_TTB_KEY (not needed for baseline).
"""
import csv, json, re, os, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter, defaultdict

OUT=Path(os.getenv("CATALOG_OUT","reports/textbook_catalog"))
OUT.mkdir(parents=True,exist_ok=True)
MAX_QUERIES=max(1,int(os.getenv("MAX_QUERIES","110")))
MAX_PAGES=max(1,min(4,int(os.getenv("MAX_PAGES","2"))))
PAGE_SIZE=40
USER_AGENT="HITEL-BookMetadataCatalog/1.0 (public metadata only)"
# Broad roots are searched without grade, year or textbook-content subfilters.
ROOTS_BY_AREA={
 "수학":["베이직쎈","개념쎈","쎈","라이트쎈","우공비Q+Q","일품","개념원리","교과서 개념잡기","개념플러스유형","체크체크","최상위수학","풍산자","수력충전","블랙라벨 수학","에이급","숨마쿰라우데","마플교과서","마플시너지","수학의 정석","수학의 바이블","일등급 수학","수학의 왕도","자이스토리 수학","마더텅 수학"],
 "국어":["매3비","매3문","빠작","오감도","한끝 국어","자이스토리 국어","마더텅 국어","올리드 국어","체크체크 국어","숨마쿰라우데 국어","해법문학","국어의 기술","EBS 수능특강 국어","EBS 수능완성 국어"],
 "영어":["천일문","중학영문법 3800제","워드마스터","능률 VOCA","리딩튜터","리스닝튜터","그래머존","그래머 인사이드","자이스토리 영어","마더텅 영어","내신콘서트","주니어 리딩튜터","EBS 수능특강 영어"],
 "과학":["오투 과학","완자 과학","하이탑","체크체크 과학","자이스토리 과학","내공의 힘 과학","개념풀 과학","EBS 수능특강 과학","1등급 만들기 과학"],
 "사회":["완자 사회","한끝 사회","체크체크 사회","올리드 사회","자이스토리 사회","개념풀 사회","마더텅 사회","EBS 수능특강 사회"],
 "역사":["체크체크 역사","한끝 역사","완자 역사","한국사능력검정 기출","자이스토리 한국사","마더텅 한국사"],
 "도덕":["체크체크 도덕","완자 도덕","내공의 힘 도덕","생활과 윤리 문제집","윤리와 사상 문제집"],
 "기술가정":["기술가정 평가문제집","기술가정 자습서"],
 "정보":["정보 교과서 평가문제집","정보 자습서","인공지능 기초 문제집"],
 "한문":["한문 평가문제집","한문 자습서"],
 "외국어":["일본어 평가문제집","중국어 평가문제집","프랑스어 평가문제집","독일어 평가문제집"],
 "예체능":["음악 평가문제집","미술 평가문제집","체육 평가문제집"],
}
# Do not treat these as found books: they are search queries only.
CURRICULUM_TERMS={
 "국어":["중학교 국어 평가문제집","고등 공통국어1 평가문제집","고등 공통국어2 문제집","고등 독서와 작문 문제집","고등 문학 문제집"],
 "영어":["중학교 영어 평가문제집","고등 공통영어1 평가문제집","고등 공통영어2 문제집","고등 영어독해 문제집"],
 "수학":["중학교 수학 1-1 문제집","중학교 수학 2-2 문제집","고등 공통수학1 문제집","고등 대수 문제집","고등 미적분Ⅰ 문제집","고등 미적분Ⅱ 문제집","고등 기하 문제집"],
 "과학":["중학교 과학 평가문제집","고등 통합과학1 문제집","고등 통합과학2 문제집","고등 물리학 문제집","고등 화학 문제집","고등 생명과학 문제집","고등 지구과학 문제집"],
 "사회":["중학교 사회 평가문제집","고등 통합사회1 문제집","고등 통합사회2 문제집","고등 사회문화 문제집","고등 정치와 법 문제집","고등 경제 문제집","고등 한국지리 문제집"],
 "역사":["중학교 역사 평가문제집","고등 한국사1 문제집","고등 한국사2 문제집","고등 세계사 문제집","고등 동아시아사 문제집"],
 "도덕":["중학교 도덕 평가문제집","고등 생활과 윤리 문제집","고등 윤리와 사상 문제집"],
 "기술가정":["중학교 기술가정 평가문제집","고등 기술가정 평가문제집"],
 "정보":["중학교 정보 평가문제집","고등 정보 교과서 문제집"],
 "한문":["중학교 한문 평가문제집"],
 "외국어":["고등 일본어 평가문제집","고등 중국어 평가문제집"],
 "예체능":["중학교 음악 평가문제집","중학교 미술 평가문제집","중학교 체육 평가문제집"],
}
SCHOOL_LEVELS=["중등","고등","복합","미분류"]
def compact(s,n=450):return re.sub(r"\s+"," ",str(s or "")).strip()[:n]
def request_json(url,params=None,headers=None):
    if params:url+="?"+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,**(headers or {})})
    for i in range(2):
        try:
            with urllib.request.urlopen(req,timeout=15) as resp:
                return json.loads(resp.read(4000000).decode("utf-8")),resp.status,""
        except urllib.error.HTTPError as ex:
            status=ex.code
            if status in (429,500,502,503) and i==0:
                time.sleep(1.5);continue
            return {},status,str(ex)[:170]
        except Exception as ex:return {},0,repr(ex)[:170]
    return {},0,"unknown request error"
def make_queries():
    roots=[]
    for area,keys in ROOTS_BY_AREA.items():
        for k in keys:roots.append({"query":k,"area":area,"kind":"기본 교재명"})
    queries=roots.copy()
    for area,keys in CURRICULUM_TERMS.items():
        for k in keys:queries.append({"query":k,"area":area,"kind":"교육과정 보완"})
    uniq={}
    for row in queries:uniq.setdefault(row["query"],row)
    return list(uniq.values())
def classify(title,area_hint=""):
    title=compact(title,500)
    mid=bool(re.search(r"중학|중등|중학교|중\s*[123]\s*[-－]|중[123](?!\d)|중학생",title))
    high=bool(re.search(r"고등|고교|고등학교|고[123](?!\d)|고\s*[123]\s*[-－]|수능|공통수학|공통국어|공통영어|통합과학[12]?|통합사회[12]?|미적분[ⅠⅡ]|대수\s*(?:개념|문제)",title))
    level="복합" if mid and high else "중등" if mid else "고등" if high else "미분류"
    grade=""
    mm=re.search(r"(?:중학|중등|중학교|중)\s*(?:수학|국어|영어|과학|사회|역사|도덕)?\s*([123])(?:학년)?(?:\s*[-－]\s*([12]))?",title)
    hh=re.search(r"(?:고등|고교|고)\s*([123])(?:학년)?(?:\s*[-－]\s*([12]))?",title)
    if level=="중등" and mm:grade=mm.group(1)
    if level=="고등" and hh:grade=hh.group(1)
    term=""
    if level=="중등" and mm and mm.group(2):term=mm.group(2)
    if level=="고등" and hh and hh.group(2):term=hh.group(2)
    if not term:
        mt=re.search(r"([12])\s*학기",title)
        if mt:term=mt.group(1)
    subjects=[
      ("기술가정",r"기술\s*[·ㆍ&/]?\s*가정|가정과학"),("정보",r"(^|[^가-힣])정보(?!통)|인공지능\s*기초|프로그래밍"),
      ("한문",r"한문"),("제2외국어",r"일본어|중국어|프랑스어|독일어|스페인어|베트남어|아랍어|러시아어"),
      ("음악",r"음악"),("미술",r"미술"),("체육",r"체육"),
      ("역사",r"역사|한국사|세계사|동아시아사"),("도덕·윤리",r"도덕|윤리"),
      ("과학",r"과학|물리|화학|생명과학|지구과학|하이탑|오투"),
      ("사회",r"사회|정치|경제|지리|법과 사회|사회문화|사회·문화"),
      ("국어",r"국어|문학|독서|화법|작문|매3비|매3문|빠작|오감도"),
      ("영어",r"영어|영문법|영단어|VOCA|voca|리딩|그래머|워드마스터|천일문|TOEIC"),
      ("수학",r"수학|쎈|풍산자|개념원리|마플|미적분|대수|기하|확률과 통계|최상위수학|블랙라벨|에이급")]
    found=[name for name,regex in subjects if re.search(regex,title,re.I)]
    area=(found[0] if found else area_hint or "미분류")
    # If named math series without 'math' in title, root hint is accepted only
    # for the unambiguous root; title classification remains provisional.
    edition=("2022 개정" if re.search(r"2022\s*(?:개정|교육과정)|22\s*개정",title)
            else "2015 개정" if re.search(r"2015\s*(?:개정|교육과정)|15\s*개정",title)
            else "판본 미확인")
    kind=("정답·해설" if re.search(r"정답|해설|정오표|답지|해답",title)
          else "교사용" if "교사용" in title else "자습서" if "자습서" in title
          else "평가문제집" if "평가문제집" in title
          else "문제집·교재 추정")
    return {"학교급":level,"학년":grade,"학기":term,"과목":area,"개정판":edition,"자료형태":kind}
def record_from_google(it,query):
    v=it.get("volumeInfo",{})
    title=compact(v.get("title",""),350)
    if not title:return None
    ids=v.get("industryIdentifiers",[])
    isbn13=next((x.get("identifier") for x in ids if x.get("type")=="ISBN_13"),"")
    href=v.get("infoLink") or v.get("canonicalVolumeLink") or ""
    if not href:return None  # no fabricated detail links
    return {"source":"Google Books","source_id":it.get("id",""),"isbn13":isbn13,
            "title":title,"subtitle":compact(v.get("subtitle"),240),
            "publisher":compact(v.get("publisher"),140),
            "authors":" | ".join(v.get("authors") or []),
            "published_date":v.get("publishedDate",""),"detail_url":href,
            "query":query["query"],"area_hint":query["area"],"query_kind":query["kind"]}
def record_from_openlibrary(it,query):
    key=it.get("key","")
    if not re.fullmatch(r"/works/OL\d+W",key or ""):return None
    title=compact(it.get("title",""),350)
    if not title:return None
    return {"source":"Open Library","source_id":key,"isbn13":next((s for s in it.get("isbn",[]) if len(s)==13),""),
      "title":title,"subtitle":"","publisher":" | ".join(it.get("publisher",[])[:2]),
      "authors":" | ".join(it.get("author_name",[])[:3]),
      "published_date":str(it.get("first_publish_year","")),
      "detail_url":"https://openlibrary.org"+key,
      "query":query["query"],"area_hint":query["area"],"query_kind":query["kind"]}
def collect_books(q,stats):
    result=[]
    for p in range(MAX_PAGES):
        params={"q":q["query"],"maxResults":PAGE_SIZE,"startIndex":p*PAGE_SIZE,
                "printType":"books","langRestrict":"ko"}
        data,status,err=request_json("https://www.googleapis.com/books/v1/volumes",params)
        count=0
        if status==200:
            for it in data.get("items",[]):
                r=record_from_google(it,q)
                if r:result.append(r);count+=1
        stats.append({"source":"Google Books","query":q["query"],"query_kind":q["kind"],
                      "status":status,"count":count,"totalItems":data.get("totalItems",""),
                      "error":err,"page":p})
        if status!=200 or count==0 or count<PAGE_SIZE:break
        time.sleep(0.12)
    return result
def collect_openlibrary(q,stats):
    # Optional secondary index. Many Korean titles have no OL metadata.
    params={"q":q["query"],"limit":30,"fields":"key,title,author_name,first_publish_year,publisher,isbn"}
    data,status,err=request_json("https://openlibrary.org/search.json",params)
    result=[]
    if status==200:
        for it in data.get("docs",[]):
            r=record_from_openlibrary(it,q)
            if r:result.append(r)
    stats.append({"source":"Open Library","query":q["query"],"query_kind":q["kind"],
                  "status":status,"count":len(result),"totalItems":data.get("numFound",""),"error":err,"page":0})
    return result
def extract_scribd(results,root,source):
    items=[]
    for it in results:
        url=it.get("url") or it.get("link") or ""
        mm=re.search(r"^https?://(?:www\.)?scribd\.com/document/(\d+)(?:/|$|\?)",url)
        if mm:
            items.append({"document_id":mm.group(1),
                "detail_url":"https://www.scribd.com/document/"+mm.group(1),
                "title":compact(it.get("title"),350),
                "root_query":root,"source":source,
                "validation":"공개 검색 색인 상세주소; Scribd 본문 완전성 미확인"})
    return items
def collect_scribd(roots,stats):
    key=os.getenv("BRAVE_SEARCH_API_KEY","").strip()
    gkey=os.getenv("GOOGLE_CSE_KEY","").strip();cx=os.getenv("GOOGLE_CSE_CX","").strip()
    hits=[]
    if not key and not (gkey and cx):
        stats.append({"source":"Scribd discovery","query":"all roots","query_kind":"API credentials",
                      "status":"NOT_CONFIGURED","count":0,"totalItems":"","error":"BRAVE_SEARCH_API_KEY or GOOGLE_CSE_KEY+CX not configured","page":0})
        return hits
    for root in roots:
        query=f'site:scribd.com/document "{root}"'
        if key:
            data,status,err=request_json("https://api.search.brave.com/res/v1/web/search",
                {"q":query,"count":20,"country":"KR","search_lang":"ko"},
                {"X-Subscription-Token":key,"Accept":"application/json"})
            results=data.get("web",{}).get("results",[])
            found=extract_scribd(results,root,"Brave Search API")
            hits.extend(found)
            stats.append({"source":"Brave Search API (Scribd)","query":root,"query_kind":"basic-series",
                          "status":status,"count":len(found),"totalItems":"","error":err,"page":0})
        elif gkey and cx:
            data,status,err=request_json("https://www.googleapis.com/customsearch/v1",
                {"key":gkey,"cx":cx,"q":query,"num":10})
            found=extract_scribd(data.get("items",[]),root,"Google Programmable Search")
            hits.extend(found)
            stats.append({"source":"Google CSE (Scribd)","query":root,"query_kind":"basic-series",
                          "status":status,"count":len(found),"totalItems":data.get("searchInformation",{}).get("totalResults",""),"error":err,"page":0})
        time.sleep(0.16)
    return hits
def write_csv(name,rows,headers):
    with (OUT/name).open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=headers,extrasaction="ignore")
        w.writeheader();w.writerows(rows)
def main():
    queries=make_queries()[:MAX_QUERIES]
    stats=[];all_results=[]
    sources_disabled=set()
    for i,q in enumerate(queries,1):
        before=len(all_results)
        if "Google Books" not in sources_disabled:
            new=collect_books(q,stats);all_results+=new
            if sum(x["source"]=="Google Books" and x["status"]!=200 for x in stats[-5:])>=4:
                sources_disabled.add("Google Books")
        if i<=min(24,MAX_QUERIES) and "Open Library" not in sources_disabled:
            new=collect_openlibrary(q,stats);all_results+=new
            if sum(x["source"]=="Open Library" and x["status"]!=200 for x in stats[-7:])>=3:
                sources_disabled.add("Open Library")
        print("BOOK_QUERY",i,len(queries),q["kind"],q["area"],q["query"],
              "new_raw",len(all_results)-before,flush=True)
    # Index results are not necessarily all workbook titles; preserve all raw rows.
    output=[]
    unique={}
    for it in all_results:
        subj=classify(it["title"],it["area_hint"])
        it.update(subj)
        # Stable ID prevents merging distinct editions accidentally.
        key=it["source"]+":"+it["source_id"]
        if key in unique:
            existing=unique[key]
            if it["query"] not in existing["matched_queries"]:
                existing["matched_queries"].append(it["query"])
            continue
        it["matched_queries"]=[it["query"]]
        unique[key]=it
    output=list(unique.values())
    filtered=[d for d in output if d["학교급"] in ("중등","고등","복합")]
    # all returned by providers, including unrelated titles, available separately
    for d in output:d["matched_queries"]=" | ".join(d["matched_queries"])
    report_fields=["source","source_id","isbn13","title","subtitle","publisher","authors","published_date",
                   "detail_url","학교급","학년","학기","과목","개정판","자료형태",
                   "query","area_hint","query_kind","matched_queries"]
    write_csv("books_raw_all.csv",output,report_fields)
    write_csv("books_middle_high.csv",filtered,report_fields)
    # each raw document detail URL remains a separate record; never count titles as Scribd files
    root_queries=list(dict.fromkeys(k for area,terms in ROOTS_BY_AREA.items() for k in terms))
    scribd=collect_scribd(root_queries,stats)
    unique_docs={}
    for d in scribd:
        id=d["document_id"]
        if id not in unique_docs:unique_docs[id]=d
        if not unique_docs[id]["title"] and d["title"]:unique_docs[id]["title"]=d["title"]
    docs=list(unique_docs.values())
    for d in docs:d.update(classify(d["title"]))
    write_csv("scribd_document_detail_links.csv",docs,["document_id","detail_url","title","root_query",
              "source","validation","학교급","학년","학기","과목","개정판","자료형태"])
    write_csv("source_queries_status.csv",stats,["source","query","query_kind","status","count","totalItems","error","page"])
    write_csv("search_queries_manifest.csv",queries,["query","area","kind"])
    summary={
      "generated_at_utc":datetime.now(timezone.utc).isoformat(),
      "coverage_statement":"Only public indexed metadata; this is NOT an exhaustive Korean middle/high workbook list.",
      "target":"all middle and high school grades, subjects and terms; mixed 2015 and 2022 curricula",
      "all_subject_categories":list(ROOTS_BY_AREA.keys()),
      "query_manifest_total":len(make_queries()),
      "queries_executed":len(queries),
      "raw_book_records":len(all_results),
      "unique_book_detail_links":len(output),
      "middle_high_classified":len(filtered),
      "by_level":dict(Counter(d["학교급"] for d in output)),
      "by_subject":dict(Counter(d["과목"] for d in filtered)),
      "individual_scribd_detail_links_new":len(docs),
      "scribd_search_capability":"configured" if os.getenv("BRAVE_SEARCH_API_KEY") or (os.getenv("GOOGLE_CSE_KEY") and os.getenv("GOOGLE_CSE_CX")) else "unavailable: no API search credentials; direct Scribd browser requests blocked by CAPTCHA",
      "requests_by_status":dict(Counter(str(s["source"])+":"+str(s["status"]) for s in stats)),
      "failed_queries":[s for s in stats if s["status"]!=200],
      "completeness_verified":False,
      "pagination_complete":False,
      "copyright_note":"Only metadata and direct book/document detail links. No textbook PDFs or page images copied."
    }
    (OUT/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    (OUT/"README.md").write_text(
        "# HITEL 중고등 전 교과 문제집 메타데이터 수집\n\n"
        f"생성: {summary['generated_at_utc']}\n\n"
        "## 파일\n"
        "- books_raw_all.csv: 공개 API 원본 목록(중고등 미분류 포함)\n"
        "- books_middle_high.csv: 중등·고등 추정 문서의 실제 도서 상세주소\n"
        "- scribd_document_detail_links.csv: Scribd 개별 문서 상세주소(검색 API 사용 가능시)\n"
        "- source_queries_status.csv: 검색별 성공·실패·총건수\n"
        "- search_queries_manifest.csv: 실제 실행 검색어와 전공\n"
        "- summary.json: 출처별 집계 및 전수조사 불가 사유\n\n"
        "이 데이터는 공개 API 색인 범위에 한정되며 모든 국내 교재의 완전 목록이 아닙니다.\n"
        "학교급/학기 자동 분류는 잠정 판정이며 교재 상세페이지 대조가 필요합니다.\n"
        "출판사와 Scribd 사용자의 원본 교재 파일은 수집하지 않습니다.\n",
        encoding="utf-8")
    print("CATALOG_SUMMARY",json.dumps({k:v for k,v in summary.items() if k!="failed_queries"},ensure_ascii=False),flush=True)
    for row in filtered[:22]:
        print("BOOK_DETAIL",row["과목"],row["학교급"],row["title"][:95],row["detail_url"],flush=True)
    return 0
if __name__=="__main__":
    sys.exit(main())
