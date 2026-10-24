#!/usr/bin/env python3
"""One-click verification: real Chromium presses production Android 실행.
Fails unless the API returns a real queued request, not just a pretty UI.
Writes expected request ID for GitHub KVM job to claim and prove end-to-end.
"""
import asyncio,json,os,time
from pathlib import Path
from playwright.async_api import async_playwright

SITE="https://hitel-communication-web-production.up.railway.app/sdk-lab"
OUT=Path("mobile-test-results/android-oneclick")
OUT.mkdir(parents=True,exist_ok=True)
def log(k,x):print("ANDROID_ONECLICK_"+k+"="+json.dumps(x,ensure_ascii=False,default=str),flush=True)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  context=await browser.new_context(viewport={"width":1440,"height":960},locale="ko-KR")
  page=await context.new_page()
  errors=[]
  page.on("pageerror",lambda error:errors.append(str(error)))
  try:
   response=await page.goto(SITE,wait_until="domcontentloaded",timeout=45000)
   assert response and response.status==200,"Railway SDK webpage HTTP != 200"
   await page.screenshot(path=str(OUT/"before-click.png"),full_page=True)
   start=page.get_by_role("button",name="Android 실행",exact=True)
   await start.wait_for(state="visible",timeout=30000)
   status=await page.evaluate("""async()=> {
    const urls=['/lab-api/apk/ui/status','/lab-api/android-native/status'];
    const entries=await Promise.all(urls.map(async x=>{const r=await fetch(x,{cache:'no-store',credentials:'same-origin'}); return [x,{http:r.status,...await r.json()}]}));
    return Object.fromEntries(entries);
   }""")
   log("BEFORE",status)
   if await start.is_disabled():
    log("FAIL","ANDROID_BUTTON_DISABLED: production has active or orphaned session")
    raise RuntimeError("Android 실행 is disabled, cannot establish one-click startup")
   async with page.expect_response(lambda r:r.url.endswith("/lab-api/apk/ui/start") and r.request.method=="POST",timeout=25000) as ev:
    await start.click()
   result=await ev.value
   obj=await result.json()
   log("CLICK_RESULT",{"http":result.status,"data":obj})
   assert result.status==202 and obj.get("status")=="queued" and obj.get("requestId"),"Start button did not queue real request"
   request_id=obj["requestId"]
   OUT.joinpath("clicked-request.json").write_text(json.dumps({"requestId":request_id,"receivedAt":time.time()},indent=2))
   if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"],"a") as f:f.write("request_id="+request_id+"\n")
   await page.wait_for_timeout(1000)
   state=await page.evaluate("""async()=>{const r=await fetch('/lab-api/apk/ui/status',{cache:'no-store',credentials:'same-origin'});return await r.json()}""")
   log("AFTER",state)
   assert state.get("requestId")==request_id and state.get("status")=="queued","Request did not persist"
   await page.screenshot(path=str(OUT/"queued.png"),full_page=True)
   assert not errors,errors
   log("PASS","BROWSER_CLICK_AND_PERSISTED_QUEUE")
  finally:
   await browser.close()

if __name__=="__main__":asyncio.run(main())
