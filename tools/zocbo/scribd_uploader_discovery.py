#!/usr/bin/env python3
"""Public Scribd uploader discovery path.

Workflow:
    broad series name search -> document detail URL -> uploader profile URL
    -> uploader's /uploads listing -> each other document URL
    -> classify title (middle/high/unknown), keep *all* results first.

No downloads of textbook content, no CAPTCHA solving/circumvention.
Direct user-provided seeds:
 - https://www.scribd.com/document/1045496147/... (2022 lite-Ssen 1-2)
 - https://www.scribd.com/user/776908909/mingoon45/uploads
Screenshot evidence supplied by user: 180 pages, uploader mingoon45,
uploaded 2026-06-01, but must be flagged as screenshot, not live verification.

Produces raw JSON, uploader profiles and document-uploader edges, URLs CSV
and auditable barrier/error reports. Never interprets challenge as 0 documents.
"""
from __future__ import annotations
import csv,json,re,os,time,hashlib
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
from playwright.sync_api import sync_playwright
from scribd_series_audit import OUT, ROOTS, classify, compact, write_csv

ROOT=OUT/"uploader-discovery"
ROOT.mkdir(parents=True,exist_ok=True)
SEED_DOCUMENTS=[
  "https://www.scribd.com/document/1045496147/22개정-라이트쎈-중1-2-본문",
  "https://www.scribd.com/document/1051530184",
  "https://www.scribd.com/document/1051530182",
  "https://www.scribd.com/document/1024768392",
  "https://www.scribd.com/document/929830551",
]
SEED_UPLOADERS=["https://www.scribd.com/user/776908909/mingoon45/uploads"]
MAX_UPLOADERS=int(os.getenv("SCRIBD_MAX_UPLOADERS","8"))
MAX_NEW_DOCUMENT_PAGES=int(os.getenv("SCRIBD_MAX_DOCUMENT_PAGES","40"))
DOCUMENT_PATTERN=re.compile(r"(?:https?://(?:www\.)?scribd\.com)?/document/(\d+)(?:/|$|\?)")
USER_PATTERN=re.compile(r"^(?:https?://(?:www\.)?scribd\.com)?(/user/(\d+)(?:/[^/?#]*)?(?:/uploads)?)",re.I)
BLOCK=re.compile(r"CAPTCHA|Client Challenge|Enter the characters seen in the image|security verification|unusual traffic|verify you are human|access denied",re.I)

def document_id(url):
    m=DOCUMENT_PATTERN.search(url)
    return m.group(1) if m else ""
def uploader_url(raw):
    m=USER_PATTERN.match(raw)
    if not m:return ""
    path=m.group(1).rstrip("/")
    if not path.endswith("/uploads"):path+="/uploads"
    return "https://www.scribd.com"+path
def screenshot_id(url):
    return hashlib.sha1(url.encode()).hexdigest()[:14]
def summarize(page,response,url):
    info={"requested_url":url,"url":page.url,"http_status":response.status if response else None,
          "title":"","body_excerpt":"","is_challenge":False}
    try:info["title"]=page.title()
    except Exception:pass
    try:info["body_excerpt"]=compact(page.locator("body").inner_text(timeout=6500),700)
    except Exception:pass
    info["is_challenge"]=bool(BLOCK.search(info["title"]+" "+info["body_excerpt"]))
    return info
def get_page(page,url,wait=1100):
    response=page.goto(url,wait_until="domcontentloaded",timeout=26000)
    page.wait_for_timeout(wait)
    return summarize(page,response,url)
def grab_links(page):
    # Keep every visible document URL, title and uploader pointer from DOM.
    # A separate URL is never synthesized for search hits not observed.
    return page.evaluate(r"""() => {
      let docs=[], users=[];
      for (const a of document.querySelectorAll('a[href]')) {
        let u;
        try {u=new URL(a.getAttribute('href'),document.baseURI)} catch(e) {continue}
        if(u.hostname !== 'www.scribd.com' && u.hostname!=='scribd.com')continue;
        const text=(a.innerText||a.getAttribute('aria-label')||a.getAttribute('title')||'').replace(/\s+/g,' ').trim();
        const parent=a.closest('article,li,[data-testid]')||a.parentElement;
        const nearby=(parent?.innerText||'').replace(/\s+/g,' ').trim().slice(0,400);
        if(/\/document\/\d+/.test(u.pathname)){
          const m=u.pathname.match(/\/document\/(\d+)/);
          docs.push({document_id:m[1],url:u.origin+u.pathname,
                     title:text.slice(0,280),listing_excerpt:nearby});
        } else if(/^\/user\/\d+/.test(u.pathname)){
          users.push({url:u.origin+u.pathname,user_text:text.slice(0,130),nearby});
        }
      }
      return {documents:docs,users:users}
    }""")
def optional_uploader_text(page):
    try:
        txt=page.locator("body").inner_text(timeout=5500)
        found=re.findall(r"Uploaded by\s+([^\n]{1,100})",txt,re.I)
        return compact(found[0],120) if found else ""
    except Exception:return ""
def scan_listing(page,url):
    rec={"uploader_url":url,"status":"","page":{},"documents":[],
         "uploader_links":[],"scrolls":0,"error":"","pagination":[]}
    docs,users={},{}
    try:
        info=get_page(page,url)
        rec["page"]=info
        if info["is_challenge"]:
            rec["status"]="CAPTCHA 차단";return rec
        stagnant=0
        for i in range(60):
            links=grab_links(page)
            added=0
            for item in links["documents"]:
                id=item["document_id"]
                if id not in docs:docs[id]=item;added+=1
                elif len(item["title"])>len(docs[id]["title"]):docs[id]=item
            for item in links["users"]:
                base=uploader_url(item["url"])
                if base:users[base]=item
            rec["scrolls"]+=1
            if not added:stagnant+=1
            else:stagnant=0
            try:
                more=page.get_by_role("button",name=re.compile("More|Load more|Show more|더 보기|더보기",re.I))
                if more.count() and more.first.is_visible(timeout=650):
                    more.first.click(timeout=1200)
            except Exception:pass
            page.evaluate("window.scrollBy(0,Math.max(window.innerHeight*2.4,1300))")
            page.wait_for_timeout(500)
            if stagnant>=10:break
        rec["pagination"]=page.evaluate(r"""()=>Array.from(document.querySelectorAll('a[href]')).filter(a=>/[?&](page|offset)=\d+/.test(a.href)).map(a=>a.href).slice(0,40)""")
        # Do not misrepresent non-enumerated pagination as complete.
        rec["status"]="일부 공개 링크 수집" if docs else "페이지 접근, 문서 링크 없음"
        rec["documents"]=list(docs.values())
        rec["uploader_links"]=sorted(users.keys())
    except Exception as exc:
        rec["status"]="접근 오류";rec["error"]=str(exc)[:500]
    return rec

def scan_detail(page,url):
    record={"document_url":url,"document_id":document_id(url),"status":"","page":{},
            "uploader_username":"","uploader_links":[],"document_links":[],"error":""}
    try:
        info=get_page(page,url)
        record["page"]=info
        if info["is_challenge"]:
            record["status"]="CAPTCHA 차단";return record
        links=grab_links(page)
        record["uploader_links"]=sorted(set(uploader_url(u["url"]) for u in links["users"] if uploader_url(u["url"])))
        record["uploader_username"]=optional_uploader_text(page)
        record["document_links"]=links["documents"][:120]
        record["status"]="상세페이지 메타데이터 수집"
    except Exception as exc:
        record["status"]="접근 오류";record["error"]=str(exc)[:400]
    return record

def main():
    # The user-supplied evidence link is a seed, not a page we claim to have re-read.
    report={"started":datetime.now(timezone.utc).isoformat(),
            "method":"detail URL -> uploader profile /uploads -> ALL public uploads -> classify afterwards",
            "screenshot_evidence":{"document_id":"1045496147","title":"(22개정) (라이트쎈) 중1-2 본문",
               "page_count":180,"uploaded_by":"mingoon45","date":"2026-06-01",
               "uploader_url":SEED_UPLOADERS[0],
               "source":"user-provided screenshot, not live server access"},
            "uploader_results":[],"document_results":[],"complete":False}
    known_docs={}
    for url in SEED_DOCUMENTS:
        id=document_id(url)
        known_docs[id]={"document_id":id,"url":"https://www.scribd.com/document/"+id,
          "title":"(22개정) (라이트쎈) 중1-2 본문" if id=="1045496147" else "",
          "discovery_sources":["seed detail URL"],"linked_uploaders":[]}
    uploader_queue=list(SEED_UPLOADERS)
    uploader_seen=set()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx=browser.new_context(locale="ko-KR",viewport={"width":1365,"height":960})
        page=ctx.new_page()
        # Try uploader listing first; don't filter out nonmath or high-school
        # materials before retaining URLs.
        while uploader_queue and len(uploader_seen)<MAX_UPLOADERS:
            up=uploader_queue.pop(0)
            if up in uploader_seen:continue
            uploader_seen.add(up)
            result=scan_listing(page,up)
            report["uploader_results"].append(result)
            print("UPLOADER",up,"status",result["status"],"links",len(result["documents"]),flush=True)
            for doc in result["documents"]:
                id=doc["document_id"]
                item=known_docs.setdefault(id,{"document_id":id,"url":"https://www.scribd.com/document/"+id,
                                               "title":"","discovery_sources":[],"linked_uploaders":[]})
                if len(doc["title"])>len(item["title"]):item["title"]=doc["title"]
                if up not in item["linked_uploaders"]:item["linked_uploaders"].append(up)
                if "uploader listing" not in item["discovery_sources"]:item["discovery_sources"].append("uploader listing")
        # After uploader result, inspect seed and newly discovered detail pages to
        # discover any more uploader profile links. Additional uploaders may be
        # explored by extending the bounded queue; never confuse challenge with zero.
        for doc in list(known_docs.values())[:MAX_NEW_DOCUMENT_PAGES]:
            result=scan_detail(page,doc["url"])
            report["document_results"].append(result)
            print("DETAIL",result["document_id"],"status",result["status"],
                  "uploader-links",len(result["uploader_links"]),flush=True)
            for up in result["uploader_links"]:
                if up not in doc["linked_uploaders"]:doc["linked_uploaders"].append(up)
                if up not in uploader_seen and up not in uploader_queue:uploader_queue.append(up)
            pg=result["page"]
            if pg and pg.get("title") and not pg["is_challenge"]:
                if len(pg["title"])>len(doc["title"]):doc["title"]=pg["title"]
        # Expand newly discovered uploader URLs, if permitted.
        while uploader_queue and len(uploader_seen)<MAX_UPLOADERS:
            up=uploader_queue.pop(0)
            if up in uploader_seen:continue
            uploader_seen.add(up)
            result=scan_listing(page,up)
            report["uploader_results"].append(result)
            print("DISCOVERED_UPLOADER",up,result["status"],len(result["documents"]),flush=True)
            for doc in result["documents"]:
                id=doc["document_id"]
                item=known_docs.setdefault(id,{"document_id":id,"url":"https://www.scribd.com/document/"+id,
                                               "title":"","discovery_sources":[],"linked_uploaders":[]})
                if len(doc["title"])>len(item["title"]):item["title"]=doc["title"]
                if up not in item["linked_uploaders"]:item["linked_uploaders"].append(up)
                if "uploader listing" not in item["discovery_sources"]:item["discovery_sources"].append("uploader listing")
        ctx.close();browser.close()
    documents=[]
    for d in sorted(known_docs.values(),key=lambda x:int(x["document_id"])):
        school=classify(d["title"])
        documents.append({"문서ID":d["document_id"],"상세페이지 주소":d["url"],
           "검색 또는 페이지 제목":d["title"],
           "중학·고등 분류":school["학교급"],"학기추정":school["학기"],
           "판본추정":school["판본"],"자료종류추정":school["자료유형"],
           "업로더 업로드 목록": " | ".join(d["linked_uploaders"]),
           "발견 경로":" | ".join(d["discovery_sources"]),
           "본문 전체 검증":"미검증"})
    write_csv(ROOT/"document_detail_urls_with_uploaders.csv",documents,[
        "문서ID","상세페이지 주소","검색 또는 페이지 제목","중학·고등 분류",
        "학기추정","판본추정","자료종류추정","업로더 업로드 목록","발견 경로","본문 전체 검증"])
    uploader_rows=[]
    for r in report["uploader_results"]:
        uploader_rows.append({"업로더 업로드 목록":r["uploader_url"],
          "접근 결과":r["status"],"실제 추출 문서수":len(r["documents"]),
          "검색 결과 완전성":"검증 안 됨",
          "오류":r["error"],"업로더 문서 URL": " | ".join(d["url"] for d in r["documents"][:200])})
    write_csv(ROOT/"uploader_profiles.csv",uploader_rows,[
        "업로더 업로드 목록","접근 결과","실제 추출 문서수","검색 결과 완전성","오류","업로더 문서 URL"])
    (ROOT/"raw_uploaders_and_details.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    status={
        "uploader_seed_url":SEED_UPLOADERS[0],
        "document_seed_url":SEED_DOCUMENTS[0],
        "uploader_pages_attempted":len(report["uploader_results"]),
        "uploader_pages_challenged":sum(x["status"]=="CAPTCHA 차단" for x in report["uploader_results"]),
        "document_pages_attempted":len(report["document_results"]),
        "document_pages_challenged":sum(x["status"]=="CAPTCHA 차단" for x in report["document_results"]),
        "known_doc_detail_urls_including_seeds":len(documents),
        "discovered_additional_doc_urls":max(0,len(documents)-len(SEED_DOCUMENTS)),
        "all_uploads_enumerated":False,
        "note":"The supplied user screenshot is evidence for 180 pages/uploader; blocked listings do not imply uploader has zero uploads."}
    (ROOT/"summary.json").write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding="utf-8")
    print("UPLOADER_AUDIT_SUMMARY",json.dumps(status,ensure_ascii=False),flush=True)

if __name__=="__main__":main()
