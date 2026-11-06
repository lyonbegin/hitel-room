#!/usr/bin/env python3
"""Acquire publicly hosted matching Samsung APKs for STATIC code analysis, never install them."""
import os,re,sys,time,hashlib,json
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT=Path("samsung-research")
ROOT.mkdir(exist_ok=True)
pages={
    "incallui": "https://www.apkmirror.com/apk/samsung-electronics-co-ltd/samsung-phone/samsung-phone-15-2-00-564-release/samsung-call-15-2-00-564-android-apk-download/",
    "dialer": "https://www.apkmirror.com/apk/samsung-electronics-co-ltd/samsung-phone-3/samsung-phone-3-15-1-87-release/samsung-phone-15-1-87-android-apk-download/",
}
session=requests.Session()
session.headers.update({
    "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept-Language":"en-US,en;q=0.9",
})
def get(url):
    r=session.get(url,timeout=45)
    print("PAGE",r.status_code,r.url,len(r.content),r.headers.get("content-type"),flush=True)
    return r

def candidates(html,base):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for tag in soup.select("a[href]"):
        href=tag.get("href")
        label=" ".join(tag.stripped_strings)
        if ("download" in href or "download" in label.lower()) and not href.startswith("javascript:"):
            full=urljoin(base,href)
            if "/download/" in full or "download.apkmirror" in full or full.endswith(".apk"):
                out.append(full)
    return list(dict.fromkeys(out))

for name,url in pages.items():
    print("====",name,flush=True)
    try:
        r=get(url)
        (ROOT/f"{name}_page.html").write_text(r.text[:100000],encoding="utf8")
        links=candidates(r.text,r.url)
        print("Candidate links",json.dumps(links[:25],ensure_ascii=False),flush=True)
        matched=False
        for link in links[:10]:
            if "premium" in link: continue
            try:
                time.sleep(2)
                z=get(link)
                content_type=z.headers.get("Content-Type","").lower()
                if z.content[:2]==b"PK" and len(z.content)>1000000:
                    (ROOT/f"{name}.apk").write_bytes(z.content)
                    print("APK SUCCESS",name,len(z.content),hashlib.sha256(z.content).hexdigest(),flush=True)
                    matched=True
                    break
                links2=candidates(z.text,z.url)
                print("Second links",json.dumps(links2[:15],ensure_ascii=False),flush=True)
                for link2 in links2[:7]:
                    if "premium" in link2: continue
                    t=get(link2)
                    if t.content[:2]==b"PK" and len(t.content)>1000000:
                        (ROOT/f"{name}.apk").write_bytes(t.content)
                        print("APK SUCCESS",name,len(t.content),hashlib.sha256(t.content).hexdigest(),flush=True)
                        matched=True
                        break
                if matched:break
            except Exception as e:print("Candidate failed",str(e)[:200],flush=True)
        if not matched: print("NO_APK",name,flush=True)
    except Exception as e:print("PAGE ERROR",name,str(e),flush=True)
