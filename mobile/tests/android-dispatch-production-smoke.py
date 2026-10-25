#!/usr/bin/env python3
"""Non-mutating real Chromium test of the production Android dispatch connection.
No TinyFish, no screenshot replay, no fake success and no new Android session.
"""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path('mobile-test-results/production-dispatch')
ROOT.mkdir(parents=True,exist_ok=True)
URL='https://hitel-communication-web-production.up.railway.app/sdk-lab'
def log(k,data):
 print('HITEL_DISPATCH_PRODUCTION_'+k+'='+json.dumps(data,ensure_ascii=False,default=str),flush=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=await browser.new_context(viewport={'width':1450,'height':960},locale='ko-KR')
  page=await ctx.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   res=await page.goto(URL,wait_until='domcontentloaded',timeout=45000)
   assert res and res.status==200,'Communication SDK page did not load'
   await page.wait_for_timeout(4200)
   values=await page.evaluate("""async()=> {
     const urls=['/lab-api/apk/ui/status','/lab-api/android-native/status'];
     const values={};
     for(const u of urls){
       const res=await fetch(u,{credentials:'same-origin',cache:'no-store'});
       values[u]={http:res.status,body:await res.json()};
     }
     return values;
   }""")
   log('API_VALUES',values)
   start=page.get_by_role('button',name='Android 실행',exact=True)
   exists=await start.count()>0
   disabled=(await start.is_disabled()) if exists else None
   log('BUTTON',{'exists':exists,'disabled':disabled})
   await page.screenshot(path=str(ROOT/'railway-android-dispatch-status.png'),full_page=True)
   assert not errors,'Unexpected React browser JS error: '+str(errors)
   status=values['/lab-api/apk/ui/status']['body']
   configured=status.get('dispatchConfigured')
   log('GITHUB_DISPATCH_CONFIGURED',configured)
   assert isinstance(configured,bool),'Production relay did not deploy dispatch configuration field'
   if configured is False:
     assert (not exists or disabled),'Misleading: Android start is enabled without a dispatch credential'
     log('RESULT','GITHUB_DISPATCH_CREDENTIAL_MISSING_AND_UI_CORRECTLY_BLOCKS_FALSE_SUCCESS')
   else:
     assert status.get('status')!='idle' or not disabled,'Dispatcher configured, but idle Android button disabled'
     log('RESULT','GITHUB_DISPATCH_CONFIGURED; LIVE_BOOT_NOT_PROVEN_BY_THIS_READ_ONLY_TEST')
  finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
