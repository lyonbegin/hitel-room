#!/usr/bin/env python3
"""Mutating production Chromium E2E for the HITEL Android website control.

No TinyFish and no fake Android. The browser clicks the actual deployed
"Android 실행" button, waits for the automatic GitHub runner to claim that
request, confirms the original scrcpy/noVNC host is online, then clicks
"Android 종료" and verifies cleanup.
"""
import asyncio,json,time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path('mobile-test-results/production-dispatch')
ROOT.mkdir(parents=True,exist_ok=True)
URL='https://hitel-communication-web-production.up.railway.app/sdk-lab'

def log(k,data):
 print('HITEL_DISPATCH_PRODUCTION_'+k+'='+json.dumps(data,ensure_ascii=False,default=str),flush=True)

async def api(page,path):
 return await page.evaluate("""async(path)=>{
   const res=await fetch(path,{credentials:'same-origin',cache:'no-store'});
   let body=null;
   try{body=await res.json()}catch{}
   return {http:res.status,body};
 }""",path)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=await browser.new_context(viewport={'width':1450,'height':960},locale='ko-KR')
  page=await ctx.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   # Railway may still be rolling the just-pushed backend/frontend commit.
   # Reload until the production API exposes the scheduled fallback and the
   # real website button is enabled.
   ready=None
   deadline=time.monotonic()+300
   while time.monotonic()<deadline:
    res=await page.goto(URL,wait_until='domcontentloaded',timeout=45000)
    assert res and res.status==200,'Communication SDK page did not load'
    await page.wait_for_timeout(2500)
    status=await api(page,'/lab-api/apk/ui/status')
    native=await api(page,'/lab-api/android-native/status')
    start=page.get_by_role('button',name='Android 실행',exact=True)
    exists=await start.count()>0
    disabled=(await start.is_disabled()) if exists else None
    ready={'status':status,'native':native,'button':{'exists':exists,'disabled':disabled}}
    log('WAIT_READY',ready)
    body=status.get('body') or {}
    if (status.get('http')==200 and body.get('launchAvailable') is True and
        body.get('scheduledFallbackConfigured') is True and
        body.get('status') in ('idle','completed','expired') and
        exists and disabled is False):
      break
    await page.wait_for_timeout(8000)
   else:
    raise AssertionError('Production did not expose an enabled automatic Android launch path')

   assert not errors,'Unexpected browser JS error before start: '+str(errors)
   log('READY',ready)

   start=page.get_by_role('button',name='Android 실행',exact=True)
   async with page.expect_response(lambda r:'/lab-api/apk/ui/start' in r.url,timeout=30000) as pending:
    await start.click()
   started=await pending.value
   start_body=await started.json()
   log('START_RESPONSE',{'http':started.status,'body':start_body})
   assert started.status==202,start_body
   assert start_body.get('status')=='queued',start_body
   assert start_body.get('launchMode') in ('scheduled-fallback','workflow_dispatch'),start_body
   request_id=start_body.get('requestId')
   assert request_id,'Missing website request id'

   # The website's own browser cookie must keep seeing this exact request.
   claimed=False
   online=False
   claim_deadline=time.monotonic()+650
   last=None
   while time.monotonic()<claim_deadline:
    status=await api(page,'/lab-api/apk/ui/status')
    native=await api(page,'/lab-api/android-native/status')
    last={'status':status,'native':native}
    body=status.get('body') or {}
    nbody=native.get('body') or {}
    if body.get('requestId') not in (None,request_id):
      raise AssertionError('Browser session switched to a different Android request')
    if body.get('status') in ('starting','running') or nbody.get('online') is True:
      claimed=True
    if nbody.get('online') is True and nbody.get('transport')=='original-scrcpy-novnc':
      online=True
      break
    if body.get('status') in ('failed','expired','completed'):
      raise AssertionError('Android request ended before original host came online: '+json.dumps(last,ensure_ascii=False))
    await page.wait_for_timeout(10000)
   log('CLAIM_AND_NATIVE',{'claimed':claimed,'online':online,'last':last})
   assert claimed,'Scheduled/dispatch runner never claimed the website request'
   assert online,'Original scrcpy/noVNC Android host never became online'

   await page.reload(wait_until='domcontentloaded',timeout=45000)
   await page.wait_for_timeout(6000)
   frame_urls=[f.url for f in page.frames]
   log('IFRAMES',frame_urls)
   assert any('/stream/1/phone.html' in u for u in frame_urls),frame_urls
   await page.screenshot(path=str(ROOT/'railway-android-live-before-stop.png'),full_page=True)

   # Give the Android runner's own native Playwright frame gate time to finish.
   # That runner fails unless a real /websockify WebSocket delivers frames.
   await page.wait_for_timeout(35000)
   stop=page.get_by_role('button',name='Android 종료',exact=True)
   assert await stop.count()>0,'Android stop button missing while native host is online'
   assert not await stop.is_disabled(),'Android stop button disabled while native host is online'
   async with page.expect_response(lambda r:'/lab-api/apk/ui/stop' in r.url,timeout=30000) as stopping:
    await stop.click()
   stopped=await stopping.value
   stop_body=await stopped.json()
   log('STOP_RESPONSE',{'http':stopped.status,'body':stop_body})
   assert stopped.status==200,stop_body

   cleanup_deadline=time.monotonic()+180
   cleaned=False
   final=None
   while time.monotonic()<cleanup_deadline:
    status=await api(page,'/lab-api/apk/ui/status')
    native=await api(page,'/lab-api/android-native/status')
    final={'status':status,'native':native}
    sb=status.get('body') or {}
    nb=native.get('body') or {}
    if nb.get('online') is not True and sb.get('status') in ('completed','idle','expired'):
      cleaned=True
      break
    await page.wait_for_timeout(8000)
   log('CLEANUP',{'cleaned':cleaned,'final':final})
   assert cleaned,'Android worker did not stop and release the disposable session'
   assert not errors,'Unexpected browser JS errors: '+str(errors)
   await page.screenshot(path=str(ROOT/'railway-android-after-stop.png'),full_page=True)
   log('RESULT','WEBSITE_CLICK_TO_ORIGINAL_ANDROID_ONLINE_TO_STOP_PASS')
  finally:
   await browser.close()

if __name__=='__main__':
 asyncio.run(main())
