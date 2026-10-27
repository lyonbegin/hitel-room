#!/usr/bin/env python3
"""Actual Chromium noVNC test on a KVM-backed Android 11 runner.
The test fails unless RFB negotiates AND real framebuffer pixels are rendered.
"""
import asyncio
import json
import os
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

OUT=Path("mobile-test-results/android-live-e2e")
BASE="https://hitel-communication-web-production.up.railway.app"
def read_session():
    j=json.loads((OUT/"request.json").read_text())
    assert j.get("status")=="queued" and j.get("sessionId"),j
    owner=None
    for line in (OUT/"owner.cookie").read_text().splitlines():
        if line.startswith("#HttpOnly_"):line=line[len("#HttpOnly_"):]
        if not line or line.startswith("#"):continue
        tokens=line.split("\t")
        if len(tokens)>=7 and tokens[5]=="hitel_kvm_owner":owner=tokens[6]
    assert owner and all(ch in "0123456789abcdef" for ch in owner),"session owner cookie missing"
    return j["sessionId"],owner

async def main():
    sid,owner=read_session()
    events=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=await browser.new_context(viewport={"width":660,"height":1140},
            locale="ko-KR",ignore_https_errors=False)
        await context.add_cookies([{
            "name":"hitel_kvm_owner","value":owner,
            "domain":"hitel-communication-web-production.up.railway.app",
            "path":"/lab-kvm/","httpOnly":True,"secure":True,"sameSite":"Strict"
        }])
        page=await context.new_page()
        page.on("console",lambda msg: events.append("console:"+msg.type+":"+msg.text[:150]))
        page.on("pageerror",lambda err:events.append("pageerror:"+str(err)[:160]))
        target=f"{BASE}/lab-kvm/novnc/phone.html?sid={sid}"
        print("ANDROID_E2E_BROWSER_NAVIGATING",target,flush=True)
        try:
            response=await page.goto(target,wait_until="domcontentloaded",timeout=35000)
            assert response and response.status==200,"noVNC HTML HTTP != 200"
            await page.wait_for_function(
                "() => document.getElementById('status')?.textContent === ''",
                timeout=75000
            )
            print("ANDROID_RFB_HANDSHAKE_BROWSER_PASS",flush=True)
            await page.screenshot(path=str(OUT/"chrome-real-android11.png"))
            await page.wait_for_timeout(4500)
            status=await page.locator("#status").inner_text()
            assert status=="","noVNC connection lost after 4.5s: "+status
            print("ANDROID_RFB_STREAM_STABLE_4_5_SECONDS",flush=True)
            image=Image.open(OUT/"chrome-real-android11.png").convert("RGB")
            sample=image.crop((30,80,min(image.width,620),min(image.height,1050)))
            histogram=sample.convert("L").histogram()
            visible=sum(histogram[24:])
            ratio=visible/sum(histogram)
            print("ANDROID_RENDERED_FRAME_NONBLACK_RATIO",round(ratio,5),flush=True)
            assert ratio>0.015,"No real Android pixels in browser canvas"
            print("ANDROID_LIVE_CHROME_FRAMEBUFFER_VERIFIED",flush=True)
        except BaseException:
            await page.screenshot(path=str(OUT/"chrome-diagnostic.png"))
            try:
                status_resp=await context.request.get(f"{BASE}/lab-kvm/status",timeout=10000)
                data=await status_resp.json()
                print("ANDROID_SERVER_VIEWER_DIAGNOSTIC",data.get("viewerDiagnostic"),flush=True)
            except Exception as e:
                print("ANDROID_STATUS_LOOKUP_ERROR",str(e)[:160],flush=True)
            print("ANDROID_CHROME_MESSAGES",json.dumps(events[-40:],ensure_ascii=False),flush=True)
            raise
        finally:
            (OUT/"chrome-console.json").write_text(json.dumps(events,ensure_ascii=False,indent=2))
            await browser.close()
if __name__=="__main__":
    asyncio.run(main())
