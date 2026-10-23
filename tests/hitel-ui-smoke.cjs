const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const out='ui-test-results';fs.mkdirSync(out,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173'],{stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=b.toString());server.stderr.on('data',b=>log+=b.toString());
const base='http://127.0.0.1:4173';
async function waitServer(){for(let i=0;i<45;i++){try{const r=await fetch(base);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('preview server did not start: '+log);}
async function run(){
 await waitServer();
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
 try {
  for(const [name,width,height] of [['mobile',390,844],['tablet',820,1180],['desktop',1440,900]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/portal',{waitUntil:'networkidle'});
   const heading=await page.locator('.hc-hero h2').innerText();
   assert(heading.includes('통화는 그대로'),'wrong landing page');
   const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert(dims.scroll<=dims.viewport+2,name+' horizontal overflow '+JSON.stringify(dims));
   assert.equal(await page.locator('.hc-quick').count(),4);
   await page.screenshot({path:out+'/hitel-v3-'+name+'-home.png',fullPage:true});
   await page.locator('.hc-entry-input input').fill('1588-0000');
   await page.locator('.hc-entry-input button').click();
   assert.equal(await page.locator('.hc-route').count(),3);
   assert.equal(await page.locator('.hc-route-muted').count(),2);
   await page.screenshot({path:out+'/hitel-v3-'+name+'-call-options.png',fullPage:true});
   for(const [path,selector] of [['/portal/find','.hc-results'],['/portal/conversations','.hc-chat-list'],['/portal/ai','.hc-ai-hero'],['/portal/my','.hc-my-profile'],['/portal/rooms','.hc-results'],['/portal/provider','.hc-provider']]){
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator(selector).count(),1,path+' missing '+selector);
   }
   await page.goto(base+'/portal/talk/demo?mode=sidecar',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.hc-call-stage').count(),1);
   assert.equal(await page.locator('.hc-caption-unavailable').count(),1);
   assert.equal(errors.length,0,'JS error: '+errors.join(';'));
   console.log('PASS '+name+': responsive, routes, call preview, media disabled correctly');
   await page.close();
  }
 } finally {await browser.close();}
}
run().then(()=>{server.kill();process.exit(0)}).catch(e=>{console.error(e);server.kill();process.exit(1)});
