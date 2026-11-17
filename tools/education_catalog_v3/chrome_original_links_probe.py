#!/usr/bin/env python3
"""Open saved original Scribd document URLs in REAL Google Chrome.

Checks the rendered DOM, headings, preview and screenshot. It never downloads
document contents, logs in or bypasses challenges. Smoke test only by default.
"""
import argparse
import csv
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

ROOT=Path(__file__).resolve().parents[2]
CAT=ROOT/"tools"/"education_catalog_v3"
CHALLENGE=re.compile(r"Client Challenge|a required part of this site couldn't load|captcha|verify you are human|"
                     r"access denied|checking your browser|security verification",re.I)
PREVIEW_SELECTORS=["[data-e2e='page']","[data-testid='page']","[class*='PageList'] canvas",
                    "[class*='pageContainer']","[class*='page_container']","canvas"]
FIELDS=["document_id","original_url","final_url","http_status","document_title","page_h1",
        "meta_og_title","meta_description","preview_elements","classification","error","screenshot"]

def inputs(n):
    manifest=json.loads((CAT/"manifest.json").read_text(encoding="utf8"))
    columns=manifest["schema"]["materials"]
    known={}
    for piece in manifest["files"]:
        if piece["type"]!="materials":
            continue
        data=json.loads((CAT/piece["file"]).read_text(encoding="utf8"))
        for row in data["rows"]:
            ob=dict(zip(columns,row))
            known[str(ob["id"])]=ob
    ids=[v.strip() for v in (CAT/"investigation-1208-ids.txt").read_text().splitlines() if v.strip()]
    assert len(ids)==1208 and len(set(ids))==1208
    records=[]
    for doc_id in ids[:n]:
        assert doc_id in known,doc_id
        original=known[doc_id]["reference_url"]
        assert re.match(r"https://(?:www\.)?scribd\.com/document/"+re.escape(doc_id)+r"(?:[/?#-]|$)",original), (doc_id,original)
        records.append((doc_id,original))
    return records

def meta(page,selector):
    try:
        return (page.locator(selector).first.get_attribute("content",timeout=1000) or "").strip()[:400]
    except Exception:
        return ""

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--limit",type=int,default=10)
    parser.add_argument("--headed",action="store_true",help="Use installed Chrome in interactive Windows desktop")
    parser.add_argument("--out",default="hitel-chrome-original-check")
    args=parser.parse_args()
    assert 1<=args.limit<=1208
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    shots=out/"screenshots";shots.mkdir(exist_ok=True)
    items=inputs(args.limit)
    rows=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel="chrome",headless=not args.headed,args=["--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1365,"height":850},locale="ko-KR")
        for seq,(docid,url) in enumerate(items,1):
            page=context.new_page()
            record=dict.fromkeys(FIELDS,"")
            record.update(document_id=docid,original_url=url)
            try:
                resp=page.goto(url,wait_until="domcontentloaded",timeout=25000)
                page.wait_for_timeout(2300)
                record["http_status"]=str(resp.status if resp else "none")
                record["final_url"]=page.url
                record["document_title"]=page.title()[:400]
                record["page_h1"]=" | ".join(page.locator("h1").all_text_contents())[:400]
                record["meta_og_title"]=meta(page,'meta[property="og:title"]')
                record["meta_description"]=meta(page,'meta[name="description"]')
                preview=sum(page.locator(selector).count() for selector in PREVIEW_SELECTORS)
                record["preview_elements"]=str(preview)
                body=page.locator("body").inner_text(timeout=4500)[:6000]
                if CHALLENGE.search(" ".join([record["document_title"],body])):
                    record["classification"]="client_challenge"
                elif preview>0:
                    record["classification"]="preview_visible"
                elif record["page_h1"] or record["meta_og_title"]:
                    record["classification"]="bibliographic_page_visible"
                else:
                    record["classification"]="no_content_verified"
                screenshot=f"screenshots/{seq:02d}-{docid}.png"
                page.screenshot(path=str(out/screenshot),full_page=False,timeout=7000)
                record["screenshot"]=screenshot
                (out/f"{docid}-body.txt").write_text(body[:1500],encoding="utf8")
            except Exception as exc:
                record["classification"]="error"
                record["error"]=type(exc).__name__+": "+str(exc)[:220]
            finally:
                rows.append(record)
                page.close()
                print("CHROME_ORIGINAL_URL "+json.dumps({"i":seq,"id":docid,"http":record["http_status"],
                      "status":record["classification"],"title":record["document_title"][:90],"url":record["final_url"]},ensure_ascii=False),flush=True)
        browser.close()
    with (out/"rows.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
    counts={key:sum(r["classification"]==key for r in rows) for key in sorted(set(r["classification"] for r in rows))}
    summary={"test":"actual_google_chrome","headless":not args.headed,"used_saved_original_urls":True,
             "not_requests":True,"checked":len(rows),"status_counts":counts,"run_time":datetime.now(timezone.utc).isoformat(),
             "source_documents_verified":counts.get("preview_visible",0),
             "note":"A visible title alone does not verify complete content or edition; screenshot and body retained."}
    (out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf8")
    print("CHROME_ORIGINAL_SUMMARY "+json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=="__main__":
    main()
