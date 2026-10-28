#!/usr/bin/env python3
"""Actual Pixel + Touch E2E for ws-scrcpy on KVM Android11, Chrome with H.264.
Tests WebCodecs, then MSE, and never substitutes static images for screen frames.
"""
import asyncio,json,subprocess,time
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path("mobile-test-results/ws-scrcpy"); OUT.mkdir(parents=True,exist_ok=True)
BASE="http://127.0.0.1:8000/"
WS="ws://127.0.0.1:8000/?action=proxy-adb&udid=emulator-5554&remote=tcp:8886"
def props(k):
 return subprocess.run(["adb","shell","getprop",k],capture_output=True,text=True,check=True).stdout.strip()
async def try_player(browser,player):
 page=await browser.new_page(viewport={"width":790,"height":1100})
 console=[]; errors=[]; sockets=[]
 page.on("console",lambda msg:console.append(msg.type+":"+msg.text[:220]))
 page.on("pageerror",lambda e:errors.append(str(e)[:300]))
 def onws(w):
  item={"url":w.url,"framesSent":0,"framesReceived":0}
  sockets.append(item)
  w.on("framesent",lambda _f:item.__setitem__("framesSent",item["framesSent"]+1))
  w.on("framereceived",lambda _f:item.__setitem__("framesReceived",item["framesReceived"]+1))
 page.on("websocket",onws)
 url=BASE+"#!action=stream&udid=emulator-5554&player="+player+"&ws="+WS.replace(":","%3A").replace("/","%2F").replace("?","%3F").replace("&","%26").replace("=","%3D")+"&fitToScreen=1&captureKeyboard=1"
 start=time.monotonic()
 result={"player":player,"connected":False,"decoded":False,"pixels":None,"inputSent":0,"errors":errors,"console":console,"sockets":sockets}
 try:
  response=await page.goto(url,wait_until="domcontentloaded",timeout=30000)
  assert response and response.status==200,"HTTP_STREAM_CLIENT_FAILED"
  probe=await page.evaluate("""async () => ({
    webcodecs:typeof VideoDecoder==='function',
    h264:typeof VideoDecoder==='function'?await VideoDecoder.isConfigSupported({codec:'avc1.42E01E',codedWidth:512,codedHeight:1088}).then(v=>v.supported).catch(()=>false):false,
    mse:typeof MediaSource==='function'&&MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
  })""")
  print("WS_SCRCPY_CODEC_SUPPORT",player,json.dumps(probe),flush=True)
  await page.wait_for_selector(".video-layer",timeout=25000)
  deadline=time.monotonic()+min(46,95)
  while time.monotonic()<deadline:
   pixels=await page.evaluate("""() => {
    const e=document.querySelector('.video-layer');
    if(!e)return {valid:false,why:'video element missing'};
    const isVideo=e instanceof HTMLVideoElement;
    const width=isVideo?e.videoWidth:e.width,height=isVideo?e.videoHeight:e.height;
    if(width<64||height<64)return {valid:false,why:'video dimensions missing',width,height,ready:e.readyState||0};
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{ctx.drawImage(e,0,0,width,height)}catch(err){return {valid:false,why:'drawImage '+String(err)}}
    let pixels;try{pixels=ctx.getImageData(0,0,width,height).data}catch(err){return {valid:false,why:'pixel read '+String(err)}}
    let colors=new Set(), bright=0, samples=0;
    const stride=Math.max(1,Math.floor(width*height/5000));
    for(let i=0;i<width*height;i+=stride){
      const j=i*4,r=pixels[j],g=pixels[j+1],b=pixels[j+2];
      colors.add((r>>4)+':'+(g>>4)+':'+(b>>4));
      if(r+g+b>70)bright++;
      samples++;
    }
    return {valid:colors.size>=12&&bright/samples>0.02,
      width,height,uniqueColors:colors.size,brightFraction:bright/samples,
      readyState:isVideo?e.readyState:null,currentTime:isVideo?e.currentTime:null};
   }""")
   result["pixels"]=pixels
   if pixels.get("valid"):
    result["decoded"]=True
    result["latencyMs"]=round((time.monotonic()-start)*1000)
    break
   await page.wait_for_timeout(800)
  result["connected"]=bool(sockets and any(s["framesReceived"]>10 for s in sockets))
  if result["decoded"]:
   print("WS_SCRCPY_REAL_FRAME_PASS",player,json.dumps(pixels),flush=True)
   el=page.locator(".video-layer").first
   region=await el.bounding_box()
   if not region or region["width"]<30:raise AssertionError("VIDEO_REGION_MISSING")
   before=sum(s["framesSent"] for s in sockets)
   x=region["x"]+region["width"]*.45
   y=region["y"]+region["height"]*.48
   await page.mouse.move(x,y)
   await page.mouse.down()
   await page.mouse.move(x,y+min(100,region["height"]*.15),steps=10)
   await page.mouse.up()
   await page.wait_for_timeout(1000)
   result["inputSent"]=sum(s["framesSent"] for s in sockets)-before
   await page.screenshot(path=str(OUT/("real-android11-"+player+".png")))
   print("WS_SCRCPY_REAL_TOUCH_WS_SENT",player,result["inputSent"],flush=True)
  return result
 except Exception as exc:
  result["exception"]=str(exc)
  return result
 finally:
  try:await page.screenshot(path=str(OUT/(player+"-last-screen.png")))
  except:pass
  await page.close()
async def main():
 assert props("sys.boot_completed")=="1","Android 11 is not booted"
 assert props("ro.build.version.release")=="11","Unexpected Android version"
 async with async_playwright() as p:
  # Playwright-bundled Chromium may ship without proprietary H264 decoding.
  # Real Google Chrome is used to test the production user's actual codec path.
  browser=await p.chromium.launch(channel="chrome",headless=True,
    args=["--no-sandbox","--autoplay-policy=no-user-gesture-required","--enable-features=PlatformHEVCDecoderSupport"])
  try:
   results=[]
   for player in ["webcodecs","mse"]:
    item=await try_player(browser,player);results.append(item)
    print("WS_SCRCPY_TRIAL",player,json.dumps({k:v for k,v in item.items() if k not in ("console","sockets")}),flush=True)
    if item["decoded"] and item["inputSent"]>0:break
   (OUT/"websocket-metrics.json").write_text(json.dumps(results,indent=2,ensure_ascii=False))
   passes=[x for x in results if x["decoded"] and x["inputSent"]>0]
   if not passes:
    print("WS_SCRCPY_DIAGNOSTICS",json.dumps(results,ensure_ascii=False)[-7000:],flush=True)
    raise AssertionError("REAL_H264_VIDEO_OR_TOUCH_NOT_VERIFIED")
   print("WS_SCRCPY_REAL_ANDROID11_NO_VNC_VIDEO_AND_TOUCH_PASS",passes[0]["player"],flush=True)
  finally:
   await browser.close()
if __name__=="__main__":
 asyncio.run(main())
