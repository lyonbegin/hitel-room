#!/usr/bin/env python3
"""Test standard Google Chrome in visible mode against public Scribd pages.
No CAPTCHA bypass; save screenshots and links if the ordinary page loads.
Search and uploader URLs are visited without sign-in or downloading documents.
"""
import os, re, json, time
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote
from playwright.sync_api import sync_playwright
out=Path("chrome-visible-scribd")
out.mkdir(parents=True, exist_ok=True)
targets=[
 ("bl_blacklabel","https://www.scribd.com/search?query="+quote("블랙라벨 수학")+"&verbatim=true"),
 ("fs_poongsanja","https://www.scribd.com/search?query="+quote("풍산자")+"&verbatim=true"),
 ("up_mingoon45","https://www.scribd.com/user/776908909/mingoon45/uploads"),
 ("doc_litesen","https://www.scribd.com/document/1045496147/22개정-라이트쎈-중1-2-본문"),
]
records=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=False,args=["--no-sandbox","--disable-dev-shm-usage","--window-size=1400,900"])
    ctx=browser.new_context(locale="ko-KR",viewport={"width":1400,"height":900},is_mobile=False)
    page=ctx.new_page()
    for ident,url in targets:
        result={"name":ident,"url":url,"loaded":False,"captchablocked":False,"document_links":[],"uploader_links":[],"title":"","error":"","body_excerpt":"","ts":datetime.now(timezone.utc).isoformat()}
        try:
            resp=page.goto(url,wait_until="domcontentloaded",timeout=30000)
            page.wait_for_timeout(2600)
            result["http"]=resp.status if resp else None
            result["title"]=page.title()
            body=page.locator("body").inner_text(timeout=12000)
            result["body_excerpt"]=" ".join(body.split())[:750]
            result["captchablocked"]=bool(re.search("Client Challenge|CAPTCHA|Enter the characters seen in the image|human verification",result["title"]+" "+result["body_excerpt"],re.I))
            page.screenshot(path=str(out/(ident+".png")),full_page=False)
            if not result["captchablocked"]:
                collected={}
                stagnant=0
                for i in range(35):
                    data=page.evaluate("""()=>Array.from(document.querySelectorAll('a[href]')).map(a=>({url:a.href,text:(a.innerText||a.getAttribute('aria-label')||'').trim()})).filter(v=>/^https:\/\/(?:www\.)?scribd\.com\/(document|user)\/\d+/.test(v.url))""")
                    previous=len(collected)
                    for d in data:
                        clean=d["url"].split("?")[0]
                        if clean not in collected or len(d["text"])>len(collected[clean]["text"]):collected[clean]=d
                    if len(collected)==previous:stagnant+=1
                    else:stagnant=0
                    page.evaluate("window.scrollBy(0,Math.max(window.innerHeight*2,1300))")
                    page.wait_for_timeout(600)
                    if stagnant>=7:break
                result["document_links"]=[v for v in collected.values() if "/document/" in v["url"]]
                result["uploader_links"]=[v for v in collected.values() if "/user/" in v["url"]]
                result["loaded"]=True
        except Exception as exc:
            result["error"]=str(exc)[:500]
        records.append(result)
        print("CHROME_VISIBLE_RESULT",json.dumps({k:(len(v) if isinstance(v,list) else v) for k,v in result.items() if k in ("name","title","http","captchablocked","loaded","error","document_links","uploader_links")},ensure_ascii=False),flush=True)
    ctx.close();browser.close()
(out/"results.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
print("FINAL_CHROME_SUMMARY",json.dumps({"visited":len(records),"pages_accessible":sum(x["loaded"] for x in records),"captcha":sum(x["captchablocked"] for x in records),"unique_links":len({d["url"] for x in records for d in x["document_links"]})},ensure_ascii=False),flush=True)
