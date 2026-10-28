#!/usr/bin/env python3
"""Actual Chrome/WebCodecs test of NetrisTV/ws-scrcpy and Android 11 in GitHub KVM."""
import asyncio,json,subprocess,time
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path("mobile-test-results/ws-scrcpy")
OUT.mkdir(parents=True,exist_ok=True)
URL=("http://127.0.0.1:8000/"
    "#!action=stream&udid=emulator-5554&player=webcodecs"
    "&ws=ws%3A%2F%2F127.0.0.1%3A8000%2F%3Faction%3Dproxy-adb%26udid%3Demulator-5554%26remote%3Dtcp%3A8886"
    "&fitToScreen=1&captureKeyboard=1")
def props():
 return subprocess.run(["adb","shell","getprop","sys.boot_completed"],
   capture_output=True,text=True,check=True).stdout.strip()
async def main():
 assert props()=="1","Android11 is not actually booted"
 console=[];errors=[];sockets=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
  page=await browser.new_page(viewport={"width":750,"height":1100})
  page.on("console",lambda m:console.append(m.type+":"+m.text[:220]))
  page.on("pageerror",lambda e:errors.append(str(e)[:300]))
  def on_ws(w):
   sockets.append({"url":w.url,"framesSent":0,"framesReceived":0})
   d=sockets[-1]
   w.on("framesent",lambda _frame:d.__setitem__("framesSent",d["framesSent"]+1))
   w.on("framereceived",lambda _frame:d.__setitem__("framesReceived",d["framesReceived"]+1))
  page.on("websocket",on_ws)
  try:
   response=await page.goto(URL,wait_until="domcontentloaded",timeout=30000)
   assert response and response.status==200,"Web client HTTP fail"
   await page.wait_for_selector("canvas",timeout=65000)
   # Real decoded Canvas pixels, not page background or a fake picture.
   deadline=time.monotonic()+95
   proof=None
   while time.monotonic()<deadline:
    v=await page.evaluate("""() => {
     const canvas=document.querySelector('canvas');
     if(!canvas||canvas.width<64||canvas.height<64)return {valid:false,why:'no decoded canvas'};
     let pixels;
     try{pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data}
     catch(e){return {valid:false,why:String(e)}}
     const colors=new Set();let nonblack=0;let sampled=0;
     const stride=Math.max(1,Math.floor((canvas.width*canvas.height)/5000));
     for(let i=0;i<canvas.width*canvas.height;i+=stride){
       const k=4*i, r=pixels[k],g=pixels[k+1],b=pixels[k+2];
       colors.add((r>>4)+'/'+(g>>4)+'/'+(b>>4));
       if(r+g+b>65)nonblack++; sampled++;
     }
     return {valid:colors.size>=12&&nonblack/sampled>=0.025,
       width:canvas.width,height:canvas.height,uniqueColors:colors.size,
       nonblackFraction:nonblack/sampled}
    }""")
    if v.get("valid"):proof=v;break
    await page.wait_for_timeout(1000)
   if not proof:
    print("WS_SCRCPY_PIXEL_LAST",json.dumps(v,ensure_ascii=False),flush=True)
    raise AssertionError("WEB_CODECS_REAL_CANVAS_FRAME_MISSING")
   print("WS_SCRCPY_REAL_H264_WEBCODECS_FRAME_PASS",json.dumps(proof),flush=True)
   await page.screenshot(path=str(OUT/"real-android11-ws-scrcpy.png"))
   canvas=page.locator("canvas").first
   bounds=await canvas.bounding_box()
   assert bounds and bounds["width"]>100 and bounds["height"]>100
   sent_before=sum(s["framesSent"] for s in sockets)
   await page.mouse.move(bounds["x"]+bounds["width"]*.55,bounds["y"]+bounds["height"]*.45)
   await page.mouse.down()
   await page.mouse.move(bounds["x"]+bounds["width"]*.55,bounds["y"]+bounds["height"]*.7,steps=12)
   await page.mouse.up()
   await page.wait_for_timeout(1800)
   sent_after=sum(s["framesSent"] for s in sockets)
   print("WS_SCRCPY_USER_INPUT_WS_SENT",sent_after-sent_before,flush=True)
   assert sent_after>sent_before,"Remote input was NOT transmitted by browser"
   await page.screenshot(path=str(OUT/"real-android11-after-input.png"))
   (OUT/"websocket-metrics.json").write_text(json.dumps(sockets,indent=2))
   print("WS_SCRCPY_BROWSER_VIDEO_AND_INPUT_PASS",flush=True)
  except BaseException:
   await page.screenshot(path=str(OUT/"ws-scrcpy-failure.png"))
   print("WS_SCRCPY_ERRORS",json.dumps(errors[-25:]),flush=True)
   print("WS_SCRCPY_CONSOLE",json.dumps(console[-35:]),flush=True)
   print("WS_SCRCPY_SOCKETS",json.dumps(sockets),flush=True)
   raise
  finally:
   (OUT/"console.json").write_text(json.dumps({"errors":errors,"console":console},ensure_ascii=False,indent=2))
   await browser.close()
if __name__=="__main__":
 asyncio.run(main())
