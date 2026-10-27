#!/usr/bin/env python3
"""Compare direct local Chrome -> VNC and Chrome -> Railway relay -> same VNC.
Only diversified real framebuffer pixels qualify as a screen render.
"""
import asyncio,json
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
OUT=Path("mobile-test-results/android-live-e2e")
BASE="https://hitel-communication-web-production.up.railway.app"
def read_session():
 j=json.loads((OUT/"request.json").read_text());assert j.get("status")=="queued" and j.get("sessionId"),j
 owner=None
 for line in (OUT/"owner.cookie").read_text().splitlines():
  if line.startswith("#HttpOnly_"):line=line[len("#HttpOnly_"):]
  if not line or line.startswith("#"):continue
  v=line.split("\t")
  if len(v)>=7 and v[5]=="hitel_kvm_owner":owner=v[6]
 assert owner and all(c in "0123456789abcdef" for c in owner)
 return j["sessionId"],owner
def colors(path):
 im=Image.open(path).convert("RGB")
 part=im.crop((20,80,min(im.width,630),min(im.height,1080)))
 color_data=part.getcolors(1000000)
 unique=len(color_data) if color_data else 1000001
 freq=max(c for c,_ in color_data)/sum(c for c,_ in color_data) if color_data else 0
 print("ANDROID_SCREEN_PIXEL_PROOF",path.name,"unique_colors",unique,"largest_color_fraction",round(freq,6),flush=True)
 return unique>=20 and freq<0.99
async def check_page(ctx,target,png,label):
 page=await ctx.new_page()
 messages=[]
 page.on("console",lambda m:messages.append(m.type+":"+m.text[:160]))
 page.on("pageerror",lambda err:messages.append("pageerror:"+str(err)[:160]))
 try:
  r=await page.goto(target,wait_until="domcontentloaded",timeout=35000)
  assert r and r.status==200, label+"_HTTP_NOT_200"
  await page.wait_for_function("() => document.querySelector('#status')?.textContent === ''",timeout=75000)
  await page.wait_for_timeout(6500)
  status=await page.locator("#status").inner_text()
  assert status=="", label+"_DISCONNECTED_"+status
  await page.screenshot(path=str(OUT/png))
  return colors(OUT/png)
 except BaseException:
  await page.screenshot(path=str(OUT/(label+"-failed.png")))
  print(label+"_CONSOLE",json.dumps(messages[-30:],ensure_ascii=False),flush=True)
  raise
 finally:await page.close()
async def main():
 sid,owner=read_session()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  context=await browser.new_context(viewport={"width":660,"height":1140},locale="ko-KR")
  await context.add_cookies([{"name":"hitel_kvm_owner","value":owner,
   "domain":"hitel-communication-web-production.up.railway.app","path":"/lab-kvm/",
   "httpOnly":True,"secure":True,"sameSite":"Strict"}])
  direct=None;relay=None
  try:
   direct=await check_page(context,"http://127.0.0.1:8099/phone.html",
     "chrome-direct-vnc.png","DIRECT_VNC")
   print("DIRECT_LOCAL_VNC_SCREEN_RENDERED",direct,flush=True)
   relay=await check_page(context,BASE+"/lab-kvm/novnc/phone.html?sid="+sid,
     "chrome-relay-vnc.png","RAILWAY_RELAY")
   print("RAILWAY_RELAY_VNC_SCREEN_RENDERED",relay,flush=True)
   if not direct or not relay:
    try:
     response=await context.request.get(BASE+"/lab-kvm/status")
     print("ANDROID_SERVER_VIEWER_DIAGNOSTIC",(await response.json()).get("viewerDiagnostic"),flush=True)
    except Exception as exc:print("DIAGNOSTIC_ERROR",str(exc),flush=True)
    raise AssertionError("ACTUAL_ANDROID_SCREEN_NOT_RENDERED direct="+str(direct)+" relay="+str(relay))
   print("ANDROID11_CHROME_DIRECT_AND_RELAY_PIXEL_PROOF_PASS",flush=True)
  finally:await browser.close()
if __name__=="__main__":asyncio.run(main())
