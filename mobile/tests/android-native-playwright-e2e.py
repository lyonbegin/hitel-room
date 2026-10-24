#!/usr/bin/env python3
"""Prove the Railway SDK iframe renders the live ORIGINAL native Android host."""
import asyncio,json,os,time
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path("mobile-test-results/android-native-browser-e2e");OUT.mkdir(parents=True,exist_ok=True)
SITE="https://hitel-communication-web-production.up.railway.app/sdk-lab"
def say(k,v):print("HITEL_NATIVE_BROWSER_"+k+"="+json.dumps(v,ensure_ascii=False,default=str),flush=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  ctx=await browser.new_context(viewport={"width":1450,"height":1000},locale="ko-KR")
  page=await ctx.new_page()
  errors=[];sockets=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  page.on("websocket",lambda sock:sockets.append(sock.url))
  try:
   r=await page.goto(SITE,wait_until="domcontentloaded",timeout=45000)
   say("SDK_HTTP",r.status)
   await page.wait_for_timeout(2000)
   await page.screenshot(path=str(OUT/"initial.png"),full_page=True)
   started=time.monotonic()
   native=None
   while time.monotonic()-started<350:
    status=await page.evaluate("""async()=>{
      const r=await fetch('/lab-api/android-native/status',{cache:'no-store',credentials:'same-origin'});
      return {http:r.status,body:await r.json()};
    }""")
    say("POLL",{"online":status["body"].get("online"),"elapsed":int(time.monotonic()-started)})
    if status["body"].get("online") and status["body"].get("url"):
     native=status["body"]["url"];break
    await page.wait_for_timeout(12000)
   if not native:
    say("RESULT","NO_LIVE_NATIVE_HOST_BEFORE_DEADLINE")
    await page.screenshot(path=str(OUT/"no-native.png"),full_page=True)
    raise RuntimeError("Original Android KVM host never came online")
   say("HOST_URL",native)
   # Reload so the React component discovers the real host and iframe loads it.
   await page.reload(wait_until="domcontentloaded",timeout=45000)
   await page.wait_for_timeout(8500)
   say("IFRAMES",[f.url for f in page.frames])
   await page.screenshot(path=str(OUT/"sdk-native-iframe.png"),full_page=True)
   embedded=[f for f in page.frames if ".trycloudflare.com" in f.url]
   say("IFRAME_FOUND",len(embedded))
   nativePage=await ctx.new_page()
   frame_events=[]
   def observe_socket(sock):
    sockets.append(sock.url)
    sock.on("framereceived",lambda data:frame_events.append(len(data) if isinstance(data,(str,bytes)) else 0))
   nativePage.on("websocket",observe_socket)
   response=await nativePage.goto(native+"/",wait_until="domcontentloaded",timeout=45000)
   await nativePage.wait_for_timeout(4000)
   say("NATIVE_HTTP",response.status)
   say("NATIVE_BODY",(await nativePage.locator("body").inner_text())[:4000])
   say("NATIVE_BUTTONS",[(await b.inner_text())[:50] for b in await nativePage.get_by_role("button").all()][:35])
   await nativePage.screenshot(path=str(OUT/"original-full-ui.png"),full_page=True)
   # Do not assert that the emulator is running solely from a static dashboard.
   start=nativePage.get_by_text("Tap to Start",exact=False)
   say("TAP_TO_START_COUNT",await start.count())
   if await start.count():
    await start.first.click(timeout=20000)
    await nativePage.wait_for_timeout(10000)
    say("AFTER_START",(await nativePage.locator("body").inner_text())[:1800])
    say("NATIVE_FRAMES",[f.url for f in nativePage.frames])
    await nativePage.screenshot(path=str(OUT/"original-live-phone.png"),full_page=True)
   say("WEBSOCKETS",sockets[:20])
   say("RECEIVED_WEBSOCKET_FRAMES",len(frame_events))
   say("PAGE_ERRORS",errors[:30])
   if response.status!=200 or not embedded:raise RuntimeError("Original UI did not embed properly inside Railway")
   if os.environ.get("HITEL_REQUIRE_NATIVE_PHONE")=="1":
    assert any("/stream/1/phone.html" in f.url for f in nativePage.frames),"Native Android phone.html iframe missing"
    assert any("/stream/1/websockify" in w for w in sockets),"Native noVNC websocket not opened"
    assert len(frame_events)>0,"No actual websocket frames from native Android display"
    assert not errors,"Browser JS errors: "+str(errors)
    say("RESULT","REAL_ANDROID_NATIVE_WEBSOCKET_AND_IFRAME_PASS")
   else:
    say("RESULT","ORIGINAL_UI_EMBEDDED_AND_NATIVE_HTTP_PASS")
  finally:
   await browser.close()
if __name__=="__main__":asyncio.run(main())
