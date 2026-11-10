#!/usr/bin/env python3
"""Scribd title-first catalogue audit.

Search by complete basic *series* name, enumerate all visible search results,
then classify individual document titles. Never conclude 'not found' from a
blocked or incomplete search. This code collects titles and links only;
it does not download or reproduce copyrighted textbooks.
"""
import json, os, re, time, traceback
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qs, quote, urlencode
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
OUT=Path("scribd-title-audit")
OUT.mkdir(parents=True,exist_ok=True)
SEARCHES=["블랙라벨 중학 수학","풍산자"]
DOCUMENT_RE=re.compile(r"/document/(\d+)(?:/|$|[?])")
def search_url(q):
    return "https://www.scribd.com/search?"+urlencode({"query":q,"verbatim":"true"})
def brief(text): return re.sub(r"\s+"," ",text or "").strip()[:200]
def classify(item):
    title=item.get("title","")
    cat=[]
    for a,b in [("중학","중학"),("중등","중학"),("중1","중학"),("중2","중학"),("중3","중학"),("고등","고등"),("고1","고등"),("고2","고등"),("고3","고등"),("초등","초등")]:
      if a in title:cat.append(b)
    grade=re.search(r"(?:중학|중등|중)\s*([123])\s*[-–~의 ]\s*([12])",title)
    if not grade: grade=re.search(r"([123])\s*[-–]\s*([12])",title)
    term=grade.group(1)+"-"+grade.group(2) if grade else ""
    typ=("정답·해설" if re.search("정답|해설|해답|답지|교사용",title) else
         "문제 일부" if re.search("일부|파트|part|발췌|특강|연습|워크북",title,re.I) else
         "본문 여부 추가 검증")
    return {"학기추정":term,"교육단계추정":",".join(sorted(set(cat))) or "미분류",
            "자료유형추정":typ}
def extract(page):
    return page.evaluate(r"""() => {
        const a=Array.from(document.querySelectorAll('a[href*="/document/"]'));
        return a.map(link=>{
          const match=link.href.match(/\/document\/(\d+)(?:\/|$|\?)/);
          if(!match)return null;
          const box=link.closest('article,[data-testid],li')||link.parentElement;
          const aria=link.getAttribute('aria-label')||"";
          const t=(link.innerText||link.getAttribute("title")||aria||(box?.innerText||"")).replace(/\s+/g," ").trim();
          return {id:match[1],url:link.href.split("?")[0],title:t.slice(0,300),
                  snippet:(box?.innerText||"").replace(/\s+/g," ").trim().slice(0,350)};
        }).filter(Boolean);
    }""")
def new_candidates(page,docs):
    added=0
    for d in extract(page):
        if d["id"] not in docs:
            docs[d["id"]]=d;added+=1
        elif len(d["title"])>len(docs[d["id"]]["title"]):
            docs[d["id"]]["title"]=d["title"]
    return added
def crawl_search(browser,q):
    print("SEARCH_START",q,search_url(q),flush=True)
    context=browser.new_context(locale="ko-KR",viewport={"width":1365,"height":920},
                                user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                                            "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"))
    page=context.new_page()
    result={"query":q,"search_url":search_url(q),"status":"unknown",
            "items":[],"paging":[],"errors":[],"snapshots":[]}
    docs={}
    try:
        response=page.goto(search_url(q),wait_until="domcontentloaded",timeout=45000)
        page.wait_for_timeout(5000)
        result["http_status"]=response.status if response else None
        result["final_url"]=page.url
        result["title"]=page.title()
        try:page.screenshot(path=str(OUT/("blacklabel" if "블랙" in q else "poongsanja")+".png"),full_page=False)
        except Exception as exc:result["errors"].append("screenshot:"+str(exc)[:100])
        body=page.locator("body").inner_text(timeout=12000)
        result["initial_body_excerpt"]=brief(body[:2500])
        result["body_search_counts"]=re.findall(r".{0,45}\b\d[\d,]*\s*(?:results?|documents?|개의?\s*(?:결과|문서|검색결과)|건).{0,45}",body[:8000],re.I)[:15]
        print("PAGE",q,"http",result["http_status"],"title",result["title"],"url",page.url,"body",repr(brief(body[:420])),flush=True)
        if any(x in body.lower() for x in ("verify you are human","access denied","unusual traffic","captcha","security check")):
            result["status"]="challenge_or_access_denied"
            return result
        stagnant=0
        for index in range(45):
            added=new_candidates(page,docs)
            result["snapshots"].append({"scroll":index,"total_unique":len(docs),"added":added})
            if index%5==0:
                print("SCROLL",q,index,"docs",len(docs),"added",added,flush=True)
            try:
                load=page.get_by_role("button",name=re.compile("load more|show more|더 보기|더보기|더 보기",re.I))
                if load.count() and load.first.is_visible(timeout=1000):load.first.click(timeout=2000)
            except Exception:pass
            page.evaluate("window.scrollBy(0,Math.max(window.innerHeight*2.4,1300))")
            page.wait_for_timeout(900)
            if added==0:stagnant+=1
            else:stagnant=0
            if stagnant>9:break
        links=page.evaluate(r"""() => Array.from(document.querySelectorAll('a[href]')).map(a=>({
                href:a.href,text:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,80)
            })).filter(x=>/page=\d+|offset=\d+/.test(x.href)).slice(0,20)""")
        result["paging"]=links
        for d in docs.values():
            title=(d["title"] or d["snippet"]).strip()
            d["title"]=title
            d.update(classify(d))
        result["items"]=list(docs.values())
        result["status"]="collected_visible_results" if docs else "search_open_but_no_document_links"
        print("SEARCH_DONE",q,"status",result["status"],"documents",len(docs),"paging",len(links),flush=True)
    except Exception as exc:
        result["status"]="error"
        result["errors"].append(str(exc)[:1000])
        print("SEARCH_ERROR",q,type(exc).__name__,str(exc)[:250],flush=True)
    finally:
        context.close()
    return result
def main():
    report={"timestamp":datetime.now(timezone.utc).isoformat(),
            "method":"exact basic series query -> public search results -> document ID dedup -> individual title classification",
            "not_coverage_claim":True,"searches":[]}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        for q in SEARCHES:
            res=crawl_search(browser,q)
            report["searches"].append(res)
            outfile=OUT/(("blacklabel" if "블랙" in q else "poongsanja")+".json")
            outfile.write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding="utf-8")
        browser.close()
    (OUT/"summary.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    for r in report["searches"]:
        print("FINAL_SUMMARY",json.dumps({
          "query":r["query"],"status":r["status"],"http":r.get("http_status"),
          "visible_doc_count":len(r["items"]),"search_count_text":r.get("body_search_counts"),
          "examples":[{"id":d["id"],"title":d["title"][:100]} for d in r["items"][:25]]
        },ensure_ascii=False),flush=True)
if __name__=="__main__":main()
