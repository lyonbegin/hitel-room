#!/usr/bin/env python3
"""Real Chromium / Playwright probe of the public Railway Communication SDK.
No TinyFish, no mock emulator and no assumed browser success.
"""
import asyncio,json,os,sys
from pathlib import Path
from playwright.async_api import async_playwright

URL="https://hitel-communication-web-production.up.railway.app/sdk-lab"
OUT=Path("mobile-test-results/android-sdk-browser")
OUT.mkdir(parents=True,exist_ok=True)
def emit(k,v):print("HITEL_BROWSER_"+k+"="+json.dumps(v,ensure_ascii=False,default=str),flush=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  context=await browser.new_context(viewport={"width":1440,"height":960},locale="ko-KR",ignore_https_errors=False)
  page=await context.new_page()
  errors=[]; network=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  page.on("console",lambda m:errors.append("CONSOLE "+m.text) if m.type=="error" else None)
  page.on("response",lambda r:network.append({"code":r.status,"url":r.url}) if "/lab-api/" in r.url else None)
  try:
   res=await page.goto(URL,wait_until="domcontentloaded",timeout=45000)
   await page.wait_for_timeout(4000)
   emit("HTTP",res.status if res else None)
   emit("TITLE",await page.title())
   emit("IFRAMES",[f.url for f in page.frames])
   emit("TEXT_INITIAL",(await page.locator("body").inner_text())[:4500])
   emit("PAGE_ERRORS",errors[:20])
   await page.screenshot(path=str(OUT/"before.png"),full_page=True)
   start=page.get_by_role("button",name="Android 실행",exact=True)
   emit("START_COUNT",await start.count())
   if await start.count():
    emit("START_DISABLED",await start.is_disabled())
   async def state():
    val=await page.evaluate("""async () => {
      const out={};
      for(const url of ['/lab-api/apk/ui/status','/lab-api/android-native/status']){
        const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
        out[url]={code:r.status,data:await r.json()};
      }
      return out;
    }""")
    emit("API_STATE",val)
    return val
   await state()
   if os.environ.get("HITEL_BROWSER_CLICK","0")=="1" and await start.count() and not await start.is_disabled():
    async with page.expect_response(lambda r:r.url.endswith("/lab-api/apk/ui/start"),timeout=30000) as wait_response:
     await start.click()
    response=await wait_response.value
    emit("START_HTTP",response.status)
    emit("START_BODY",(await response.text())[:900])
    await page.wait_for_timeout(6000)
    emit("TEXT_AFTER_CLICK",(await page.locator("body").inner_text())[:2000])
    await state()
   await page.screenshot(path=str(OUT/"after.png"),full_page=True)
   emit("NETWORK",network[-40:])
   emit("PAGE_ERRORS_FINAL",errors[:30])
  except Exception as e:
   emit("EXCEPTION",repr(e))
   await page.screenshot(path=str(OUT/"failed.png"),full_page=True)
   raise
  finally:
   await browser.close()
if __name__=="__main__":asyncio.run(main())
