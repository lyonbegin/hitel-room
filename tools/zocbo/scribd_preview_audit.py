#!/usr/bin/env python3
"""Scribd public preview audit: visit a SMALL set of document pages, save
one visible viewport screenshot per document; never download full PDFs,
attempt authentication, solve CAPTCHA, or bypass access restrictions.
"""
import argparse,csv,json,re,time
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

def clean_id(value):
    m=re.search(r"(?:/document/)?(\d{6,12})",value)
    return m.group(1) if m else ""

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--ids",default="810318131,870027531,516182254")
    ap.add_argument("--limit",type=int,default=3)
    ap.add_argument("--out",default="scribd-preview-evidence")
    opts=ap.parse_args()
    out=Path(opts.out);out.mkdir(parents=True,exist_ok=True)
    ids=list(dict.fromkeys(filter(None,(clean_id(x) for x in re.split(r"[,;\n ]+",opts.ids)))))[:min(max(1,opts.limit),15)]
    rows=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel="chrome",headless=False,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(locale="ko-KR",viewport={"width":1440,"height":900},device_scale_factor=1)
        page=context.new_page()
        for doc_id in ids:
            url="https://www.scribd.com/document/"+doc_id
            data={"document_id":doc_id,"requested_url":url,"final_url":"","http_status":None,
                  "page_title":"","h1":"","body_excerpt":"","status":"error",
                  "preview_hint":False,"screenshot":"","error":"",
                  "checked_utc":datetime.now(timezone.utc).isoformat()}
            try:
                response=page.goto(url,wait_until="domcontentloaded",timeout=35000)
                page.wait_for_timeout(2500)
                data["final_url"]=page.url
                data["http_status"]=response.status if response else None
                data["page_title"]=page.title()
                data["h1"]=page.locator("h1").first.inner_text(timeout=2500)[:250] if page.locator("h1").count() else ""
                body=page.locator("body").inner_text(timeout=6000)
                data["body_excerpt"]=" ".join(body.split())[:900]
                is_blocked=bool(re.search(r"Client Challenge|CAPTCHA|verify you are human|access denied|security verification|enter the characters",data["page_title"]+" "+body[:1000],re.I))
                data["status"]="blocked" if is_blocked else ("http_error" if data["http_status"] and data["http_status"]>=400 else "page_loaded")
                if not is_blocked and data["status"]=="page_loaded":
                    selectors=["[data-e2e='page']","[data-testid*='page']","[class*='PageList'] canvas",
                               "[class*='page_container']","[class*='pageContainer']","canvas"]
                    for sel in selectors:
                        try:
                            item=page.locator(sel).first
                            if item.count() and item.is_visible(timeout=800):
                                item.scroll_into_view_if_needed(timeout=2500)
                                data["preview_hint"]=True
                                break
                        except Exception:pass
                    if not data["preview_hint"]:
                        page.evaluate("window.scrollTo(0,Math.min(850,document.documentElement.scrollHeight*0.15))")
                    page.wait_for_timeout(1800)
                screenshot=out/("document_"+doc_id+".png")
                page.screenshot(path=str(screenshot),full_page=False,animations="disabled",timeout=18000)
                data["screenshot"]=str(screenshot)
            except Exception as exc:
                data["error"]=str(exc)[:600]
                try:
                    screenshot=out/("document_"+doc_id+"_error.png")
                    page.screenshot(path=str(screenshot),full_page=False,timeout=12000)
                    data["screenshot"]=str(screenshot)
                except Exception:pass
            rows.append(data)
            print("PREVIEW_AUDIT",json.dumps({k:data[k] for k in ("document_id","status","http_status","page_title","preview_hint","screenshot","error")},ensure_ascii=False),flush=True)
            page.wait_for_timeout(1200)
        context.close();browser.close()
    (out/"summary.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")
    with (out/"summary.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ["document_id"])
        w.writeheader();w.writerows(rows)
    print("FINAL_PREVIEW_SUMMARY",json.dumps({"attempted":len(rows),"loaded":sum(x["status"]=="page_loaded" for x in rows),"blocked":sum(x["status"]=="blocked" for x in rows),"preview_hints":sum(x["preview_hint"] for x in rows)},ensure_ascii=False),flush=True)

if __name__=="__main__":main()
