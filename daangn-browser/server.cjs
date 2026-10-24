const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {chromium}=require('playwright-core');
const ROOT='/tmp/daangn-evidence';fs.mkdirSync(ROOT,{recursive:true});
const URL0='https://www.daangn.com/kr/search/local-profile/';
const URL1='https://hitel-fusion-web-production.up.railway.app/daangn.html';
const report={phase:'starting',created_at:new Date().toISOString(),source:URL0,previous:URL1,tools:{},errors:[],steps:[]};
let browserProcess;
const truncate=(s,n=5000)=>String(s??'').slice(0,n);
const saveJSON=()=>fs.writeFileSync(ROOT+'/report.json',JSON.stringify(report,null,2));
const step=(label,extra={})=>{report.steps.push({label,time:new Date().toISOString(),...extra});console.log('AUDIT_STEP '+label);saveJSON()};
const attempt=async(label,fn)=>{try{const v=await fn();report.tools[label]={ok:true,result:v};saveJSON();return v}catch(e){report.tools[label]={ok:false,error:truncate(e?.stack||e,2000)};saveJSON();return null}};
async function waitChrome(){for(let i=0;i<120;i++){try{const r=await fetch('http://127.0.0.1:9222/json/version');if(r.ok)return await r.json()}catch{}await new Promise(r=>setTimeout(r,500))}throw Error('CDP port not ready')}
async function mcp(label,args,preferred,toolargs={}){
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');
 const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');
 const c=new Client({name:'hitel-daangn-audit',version:'1.0.0'},{capabilities:{}});
 const t=new StdioClientTransport({command:'npx',args:['--no-install',...args],env:{...process.env,NO_COLOR:'1'}});
 try{
  await c.connect(t);
  const items=(await c.listTools()).tools.map(x=>x.name);
  const name=items.find(x=>x===preferred)||'';
  const result=name?await c.callTool({name,arguments:toolargs},{timeout:20000}):null;
  return {available:items,succeeded:!!name&&!result?.isError,response:truncate(JSON.stringify(result),6000),error:!name?'requested tool not registered':undefined}
 } finally {await c.close().catch(()=>{})}
}
async function cli(name,args,timeout=18000){const executable=path.join(process.cwd(),'node_modules','.bin',name);const r=await run(executable,args,{timeout,maxBuffer:15000000,env:{...process.env,REA_BROWSER_OBSERVE_ENABLED:'true',REA_BROWSER_CDP_ENDPOINTS_JSON:'["http://127.0.0.1:9222"]',REA_BROWSER_ALLOWED_ORIGINS_JSON:'["https://www.daangn.com","https://hitel-fusion-web-production.up.railway.app"]'}});return truncate(r.stdout,12000)}
const summarize=async(page)=>{
 return page.evaluate(()=>{
  const box=(el)=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {tag:el.tagName.toLowerCase(),text:(el.innerText||el.getAttribute('aria-label')||'').slice(0,110),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),display:cs.display,font:cs.fontFamily,fontSize:cs.fontSize,color:cs.color,background:cs.backgroundColor}};
  return {url:location.href,title:document.title,viewport:[innerWidth,innerHeight],text:document.body.innerText.slice(0,4500),mainHeading:[...document.querySelectorAll('h1,h2,h3')].slice(0,25).map(box),
  header:[...document.querySelectorAll('header,nav,[role="navigation"]')].slice(0,12).map(box),
  controls:[...document.querySelectorAll('input,select,button,[role="button"],[role="combobox"]')].slice(0,70).map(box),
  images:[...document.querySelectorAll('img')].slice(0,60).map(e=>({...box(e),src:e.currentSrc||e.src,loaded:e.complete&&e.naturalWidth>0,natural:[e.naturalWidth,e.naturalHeight]})),
  links:[...document.querySelectorAll('a')].slice(0,40).map(e=>({text:(e.innerText||'').slice(0,90),href:e.href})),
  bodyBox:box(document.body)}
 })
}
async function capture(name,page){await page.screenshot({path:ROOT+'/'+name+'.png',fullPage:false,timeout:16000});step('screenshot:'+name,{url:page.url()})}
async function emitAuditEvidence(){
 const a=report.tools.original_capture?.result||{},b=report.tools.previous_navigation?.result||{};
 const brief={phase:report.phase,source:{title:a.title,url:a.url,viewport:a.viewport,headings:a.mainHeading?.slice(0,8),header:a.header?.slice(0,5),controls:a.controls?.slice(0,12),images:a.images?.slice(0,14)},previous:{status:b.status,title:b.dom?.title},toolStatus:Object.fromEntries(Object.entries(report.tools).map(([k,v])=>[k,{ok:v.ok,error:v.error?.slice(0,500),succeeded:v.result?.succeeded}])),diff:report.tools.screenshot_image_comparison?.result,errors:report.errors};
 console.log('DAANGN_AUDIT_SUMMARY='+JSON.stringify(brief));
 for(const name of ['original','previous']){try{const buf=await require('sharp')(ROOT+'/'+name+'.png').resize({width:1000,withoutEnlargement:true}).jpeg({quality:55}).toBuffer();const bs=buf.toString('base64');for(let i=0;i<bs.length;i+=1600)console.log('DAANGN_IMAGE_'+name+'_'+Math.floor(i/1600)+'='+bs.slice(i,i+1600));console.log('DAANGN_IMAGE_'+name+'_END='+Math.ceil(bs.length/1600));}catch(e){console.log('DAANGN_IMAGE_ERROR_'+name+'='+String(e))}}
}
async function audit(){
 report.phase='opening_chromium';saveJSON();
 browserProcess=spawn('chromium',['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--headless=new','--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1','--remote-allow-origins=*','--user-data-dir=/tmp/daangn-source-profile','--window-size=1440,900','--password-store=basic','about:blank'],{stdio:'ignore'});
 await attempt('cdp_ready',waitChrome);
 report.phase='observing_original';saveJSON();
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
 const ctx=browser.contexts()[0];const page=ctx.pages()[0]||await ctx.newPage();await page.setViewportSize({width:1440,height:900});
 const requests=[];page.on('response',r=>{if(requests.length<250)requests.push({status:r.status(),url:truncate(r.url(),350),type:r.request().resourceType()})});
 await attempt('original_navigation',async()=>{const r=await page.goto(URL0,{waitUntil:'domcontentloaded',timeout:35000});return {status:r?.status(),url:page.url()}});
 await page.waitForTimeout(4500);
 await attempt('original_capture',async()=>{await capture('original',page);return await summarize(page)});
 report.network=requests;saveJSON();
 await attempt('playwright_mcp',()=>mcp('Playwright', ['@playwright/mcp','--headless','--cdp-endpoint=http://127.0.0.1:9222'],'browser_snapshot'));
 await attempt('chrome_devtools_mcp',()=>mcp('Chrome DevTools',['chrome-devtools-mcp','--browserUrl=http://127.0.0.1:9222','--no-usage-statistics'],'take_snapshot'));
 const targets=await attempt('rea_targets',()=>cli('rea',['list-browser-targets','http://127.0.0.1:9222','--approved','--json']));
 if(targets){try{const obj=JSON.parse(targets); const txt=JSON.stringify(obj); const target=/(?:\"target_id\"|\"id\")\s*:\s*\"([0-9A-Fa-f-]{16,})\"/.exec(txt)?.[1]; if(target)await attempt('rea_inspect',()=>cli('rea',['inspect-web-page','http://127.0.0.1:9222',target,'--observation-ms','1000','--approved','--json'],30000));else step('rea: target id not found',{output:truncate(targets,700)});}catch(e){step('rea parse failed',{error:String(e)})}}
 report.phase='checking_search_and_region';saveJSON();
 await attempt('search_input',async()=>{const inp=page.locator('input[placeholder*="검색"],input[type="search"]').first(); const count=await inp.count(); if(!count)return {available:false};await inp.fill('입주청소');await inp.press('Enter');await page.waitForTimeout(2000);await capture('searched',page);return {available:true,after:await summarize(page)}});
 await attempt('region_menu',async()=>{const el=page.getByText(/서초4동|지역 선택|동네 선택/).first();if(!await el.count())return {available:false};await el.click({timeout:5000});await page.waitForTimeout(900);await capture('region',page);return {available:true,after:await summarize(page)}});
 report.phase='comparing_previous_clone';saveJSON();
 const old=await ctx.newPage();await old.setViewportSize({width:1440,height:900});
 await attempt('previous_navigation',async()=>{const r=await old.goto(URL1,{waitUntil:'domcontentloaded',timeout:25000});await old.waitForTimeout(1800);await capture('previous',old);return {status:r?.status(),dom:await summarize(old)}});
 await attempt('screenshot_image_comparison',async()=>{const sharp=require('sharp'),a=await sharp(ROOT+'/original.png').resize(1440,900).removeAlpha().raw().toBuffer(),b=await sharp(ROOT+'/previous.png').resize(1440,900).removeAlpha().raw().toBuffer();let diff=0,total=0;for(let i=0;i<a.length;i+=3){let d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);total+=d; if(d>60)diff++}return {width:1440,height:900,nonmatching_pixel_ratio:+(diff/(a.length/3)).toFixed(4),mean_absolute_channel_difference:+(total/a.length).toFixed(2),method:'pixel RGB absolute difference, threshold sum > 60'}});
 await browser.close();
 report.phase='complete';report.finished_at=new Date().toISOString();saveJSON();await emitAuditEvidence();
}
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/health'){res.writeHead(200);return res.end('ok')}
 if(u.pathname==='/status'||u.pathname==='/report'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});return res.end(JSON.stringify(u.pathname==='/status'?{phase:report.phase,tools:Object.fromEntries(Object.entries(report.tools).map(([k,v])=>[k,v.ok])),errors:report.errors}:report))}
 if(/^\/image\/(original|previous|searched|region)\.png$/.test(u.pathname)){
 const file=ROOT+'/'+u.pathname.split('/').pop();if(fs.existsSync(file)){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});return fs.createReadStream(file).pipe(res)}
 res.writeHead(404);return res.end('capture missing')}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<html lang="ko"><meta charset="utf-8"><h1>HITEL 당근 단일 사이트 브라우저 감사</h1><p>상태: '+report.phase+'</p><p><a href="/report">검증 JSON</a> | <a href="/image/original.png">원본 캡처</a> | <a href="/image/previous.png">이전 시제품 캡처</a> | <a href="/image/region.png">지역 선택 캡처</a></p><p>Playwright MCP + Chrome DevTools MCP + REA 성공·실패 모두 기록합니다.</p></html>')
}).listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>{console.log('HITEL Daangn audit service started');setTimeout(()=>{console.log('AUDIT_WATCHDOG phase='+report.phase);emitAuditEvidence().catch(console.error)},95000).unref();audit().catch(e=>{report.phase='failed';report.errors.push(truncate(e?.stack||e));saveJSON();console.error(e);emitAuditEvidence().catch(console.error)})});
