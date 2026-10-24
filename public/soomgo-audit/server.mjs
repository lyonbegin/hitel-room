import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { spawn } from 'node:child_process';
import { auditTools } from './tools-runner.mjs';
const BASE='/tmp/hitel-soomgo-audit';
const TARGETS={
categoriesOriginal:'https://soomgo.com/categories?from=web_gnb',
categoriesClone:'http://127.0.0.1:8080/categories',
original:"https://soomgo.com/search/pro/%EC%9D%B4%EC%82%AC-%EC%9E%85%EC%A3%BC-%EC%B2%AD%EC%86%8C-%EC%97%85%EC%B2%B4/%EC%84%9C%EC%9A%B8-%EC%84%B1%EB%8F%99%EA%B5%AC/%EC%9D%B4%EC%82%AC-%EC%B2%AD%EC%86%8CA--%EC%9E%85%EC%A3%BC-%EC%A7%91-%EC%B2%AD%EC%86%8CA/review_count",
region:"https://soomgo.com/search/pro/%EC%9D%B4%EC%82%AC-%EC%9E%85%EC%A3%BC-%EC%B2%AD%EC%86%8C-%EC%97%85%EC%B2%B4/%EC%84%9C%EC%9A%B8-%EA%B0%95%EB%B6%81%EA%B5%AC/%EC%9D%B4%EC%82%AC-%EC%B2%AD%EC%86%8CA--%EC%9E%85%EC%A3%BC-%EC%A7%91-%EC%B2%AD%EC%86%8CA",
search:"https://soomgo.com/search/pro/%EC%9D%B4%EC%82%AC-%EC%9E%85%EC%A3%BC-%EC%B2%AD%EC%86%8C-%EC%97%85%EC%B2%B4/%EC%9D%B8%EC%B2%9C-%EA%B3%84%EC%96%91%EA%B5%AC/%EC%9D%B4%EC%82%AC-%EC%B2%AD%EC%86%8CA--%EC%9E%85%EC%A3%BC-%EC%A7%91-%EC%B2%AD%EC%86%8CA",
clone:'http://127.0.0.1:8080/clone',
cloneRegion:'http://127.0.0.1:8080/clone',
baseline:'https://hitel-fusion-web-production.up.railway.app/soomgo.html'
};
const VIEW={width:1440,height:900};
let state={status:'pending',startedAt:null,finishedAt:null,stages:{},toolStatus:{},difference:null,errors:[]};
let running=false,lastStart=0;
const limit=(s,n=200)=>String(s||'').slice(0,n);
const asJson=o=>JSON.stringify(o,null,2);
const fileMap=new Map([['original.png','image/png'],['search.png','image/png'],['region.png','image/png'],['cloneRegion.png','image/png'],['clone.png','image/png'],['baseline.png','image/png'],['diff.png','image/png'],['original.json','application/json'],['search.json','application/json'],['region.json','application/json'],['cloneRegion.json','application/json'],['clone.json','application/json'],['baseline.json','application/json'],['report.json','application/json'],['categoriesOriginal.png','image/png'],['categoriesClone.png','image/png'],['categoriesDiff.png','image/png'],['categoriesOriginal.json','application/json'],['categoriesClone.json','application/json']]);
async function command(cmd,args,timeout=13000){return await new Promise(resolve=>{let stdout='',stderr='',done=false;const p=spawn(cmd,args,{cwd:'/app',env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});const kill=setTimeout(()=>{if(!done){done=true;p.kill('SIGKILL');resolve({ok:false,reason:'timeout',stdout:stdout.slice(0,500),stderr:stderr.slice(0,500)})}},timeout);p.stdout.on('data',s=>stdout+=s.toString().slice(0,1500));p.stderr.on('data',s=>stderr+=s.toString().slice(0,1500));p.on('error',e=>{if(!done){done=true;clearTimeout(kill);resolve({ok:false,reason:e.message})}});p.on('close',c=>{if(!done){done=true;clearTimeout(kill);resolve({ok:c===0,exitCode:c,stdout:stdout.slice(0,1300),stderr:stderr.slice(0,1200)})}})})}
async function toolChecks(){
const tools=[['playwrightMCP','./node_modules/.bin/playwright-mcp',['--help']],['chromeDevToolsMCP','./node_modules/.bin/chrome-devtools-mcp',['--help']],['REA','./node_modules/.bin/rea',['--help']]];
for(const [n,cmd,args] of tools){state.toolStatus[n]=await command(cmd,args,10000)}
}
async function capture(name,url){
const result={url,startedAt:new Date().toISOString(),status:'started',httpStatus:null,consoleErrors:[],network:[],images:[],elements:[]};
let browser;
try{
browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:25000});
const context=await browser.newContext({viewport:VIEW,deviceScaleFactor:1,locale:'ko-KR',userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'});
const page=await context.newPage();
page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(limit(m.text(),300))});
page.on('response',response=>{if(result.network.length<350)result.network.push({url:limit(response.url(),650),status:response.status(),type:response.request().resourceType()})});
const response=await page.goto(url,{timeout:48000,waitUntil:'domcontentloaded'});
result.httpStatus=response?.status()??null;
await page.waitForTimeout(name.startsWith('categories')?3600:2600);
if(name==='region'||name==='cloneRegion'){try{const b=name==='region'?page.getByRole('button',{name:/지역|서울|위치/}).first():page.locator('#placeSelect');await b.click({timeout:9000});await page.waitForTimeout(950);result.interaction='clicked region selector'}catch(e){result.interaction='failed: '+String(e.message).slice(0,600)}}
result.pageUrl=page.url();result.title=await page.title();result.bodyLength=await page.locator('body').innerText().then(t=>t.length).catch(()=>0);
result.snapshot=await page.evaluate(()=>{
const rect=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
const style=e=>{const c=getComputedStyle(e);return {display:c.display,position:c.position,background:c.backgroundColor,font:c.fontFamily,fontSize:c.fontSize,color:c.color,padding:c.padding,margin:c.margin,border:c.border}};
return{url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},bodyText:document.body?.innerText.slice(0,25000),controls:[...document.querySelectorAll('input,button,select,a,[role="button"]')].slice(0,350).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,130),placeholder:e.getAttribute('placeholder'),href:e.getAttribute('href'),rect:rect(e)})),elements:[...document.querySelectorAll('header,main,aside,nav,section,article,[class*="card"],[class*="search"],[class*="region"],[class*="location"]')].slice(0,150).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,150),rect:rect(e),style:style(e)})),images:[...document.images].slice(0,220).map(e=>({src:e.currentSrc||e.src,alt:e.alt,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,rect:rect(e)}))};
});
result.images=result.snapshot.images.length;result.elements=result.snapshot.elements.length;
const screenshot=path.join(BASE,name+'.png');await page.screenshot({path:screenshot,fullPage:false,timeout:20000});
result.status=result.httpStatus>=400?'http_error':'captured';result.finishedAt=new Date().toISOString();
const summary={name,status:result.status,httpStatus:result.httpStatus,pageUrl:result.pageUrl,title:result.title,bodyLength:result.bodyLength,bodyText:result.snapshot?.bodyText?.slice(0,name.startsWith('categories')?24000:4800),controls:result.snapshot?.controls?.slice(0,name.startsWith('categories')?170:50),elements:result.snapshot?.elements?.slice(0,35),images:result.snapshot?.images?.slice(0,name.startsWith('categories')?75:28),network:result.network?.filter(r=>r.url?.includes('daangn.com')).slice(0,12)};
console.log('HITEL_STAGE '+JSON.stringify(summary));
if(['original','clone','categoriesOriginal','categoriesClone'].includes(name)){try{const jpeg=(await page.screenshot({type:'jpeg',quality:36,fullPage:false,timeout:20000})).toString('base64');const segment=6000;const total=Math.ceil(jpeg.length/segment);for(let i=0;i<total;i++)console.log('HITEL_JPEG|'+name+'|'+i+'|'+total+'|'+jpeg.slice(i*segment,(i+1)*segment));console.log('HITEL_JPEG_DONE '+name+' '+total)}catch(ex){console.log('HITEL_JPEG_ERROR '+name+' '+String(ex.message||ex))}}
await fs.writeFile(path.join(BASE,name+'.json'),asJson(result));
await browser.close();return result;
}catch(e){result.status='failed';result.error=String(e.message||e).slice(0,2400);result.finishedAt=new Date().toISOString();await fs.writeFile(path.join(BASE,name+'.json'),asJson(result));if(browser)await browser.close().catch(()=>{});return result}
}
async function diff(nameA='original',nameB='clone',output='diff.png'){
try{const pa=PNG.sync.read(await fs.readFile(path.join(BASE,nameA+'.png')));const pb=PNG.sync.read(await fs.readFile(path.join(BASE,nameB+'.png')));if(pa.width!==pb.width||pa.height!==pb.height)throw Error('image dimensions do not match');
const d=new PNG({width:pa.width,height:pa.height});const mismatch=pixelmatch(pa.data,pb.data,d.data,pa.width,pa.height,{threshold:0.12});
const sections={};
for(const [name,x0,x1] of [['left-filters',0,420],['provider-results',420,1440]]){
 const w=x1-x0,h=pa.height;const ai=Buffer.alloc(w*h*4),bi=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++){Buffer.from(pa.data).copy(ai,y*w*4,(y*pa.width+x0)*4,(y*pa.width+x1)*4);Buffer.from(pb.data).copy(bi,y*w*4,(y*pb.width+x0)*4,(y*pb.width+x1)*4);}
 const diffData=new Uint8Array(ai.length);const n=pixelmatch(ai,bi,diffData,w,h,{threshold:0.12});
 sections[name]={mismatchedPixels:n,totalPixels:w*h,differencePercent:+(n/(w*h)*100).toFixed(2)};
}
await fs.writeFile(path.join(BASE,output),PNG.sync.write(d));return{status:'computed',totalPixels:pa.width*pa.height,mismatchedPixels:mismatch,differencePercent:+(mismatch/(pa.width*pa.height)*100).toFixed(2),width:pa.width,height:pa.height,regions:sections};
}catch(e){return{status:'unavailable',reason:String(e.message||e)}}
}
async function runAudit(){
if(running||Date.now()-lastStart<40000)return false;running=true;lastStart=Date.now();await fs.mkdir(BASE,{recursive:true});state={status:'running',startedAt:new Date().toISOString(),finishedAt:null,stages:{},toolStatus:{},difference:null,errors:[]};
try{await toolChecks();for(const [name,url] of Object.entries(TARGETS)){state.stages[name]=await capture(name,url);if(state.stages[name].status==='failed')state.errors.push(name+': '+state.stages[name].error)}
state.categoriesDifference=state.stages.categoriesOriginal?.status==='captured'&&state.stages.categoriesClone?.status==='captured'?await diff('categoriesOriginal','categoriesClone','categoriesDiff.png'):{status:'unavailable'};console.log('HITEL_CATEGORIES_DIFF '+JSON.stringify(state.categoriesDifference));
state.difference=state.stages.original?.status==='captured'&&state.stages.clone?.status==='captured'?await diff():{status:'unavailable',reason:'original and clone must both be successfully captured'};state.status=state.stages.original?.status==='captured'&&state.stages.clone?.status==='captured'?'captured':'partial';
console.log('HITEL_RESULT '+JSON.stringify({status:state.status,difference:state.difference,errors:state.errors,stages:Object.fromEntries(Object.entries(state.stages).map(([k,v])=>[k,{status:v.status,httpStatus:v.httpStatus,url:v.pageUrl,error:v.error||null}]))}));
const toolResult=await auditTools();state.toolAudit={status:toolResult.status,steps:Object.fromEntries(Object.entries(toolResult.steps||{}).map(([k,v])=>[k,{status:v.status,action:v.action,error:v.error,discovery:v.discovery?.ok,inspection:v.inspection?.ok}]))};console.log('HITEL_TOOLS '+JSON.stringify(state.toolAudit));}
catch(e){state.status='failed';state.errors.push(String(e.message||e))}
finally{state.finishedAt=new Date().toISOString();await fs.writeFile(path.join(BASE,'report.json'),asJson(state)).catch(()=>{});running=false;}return true
}
function html(){const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let stages=Object.entries(state.stages).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v.status)+'</td><td>'+esc(v.httpStatus)+'</td><td>'+esc(v.title)+'</td><td>'+esc(v.images)+'</td></tr>').join('');
return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HITEL 숨고 원본 분석</title><style>body{font:15px system-ui;background:#f7f7f7;color:#222;margin:28px;max-width:1460px}a{color:#0a684c}button{font-size:16px;padding:9px 15px}pre{white-space:pre-wrap;background:#fff;padding:15px}table{border-collapse:collapse;background:#fff;width:100%}td,th{padding:10px;border:1px solid #ddd}img{width:100%;display:block;border:1px solid #ddd}.cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{background:white;padding:16px;margin:16px 0}@media(max-width:900px){.cols{grid-template-columns:1fr}}</style><h1>숨고 고수찾기 · 서버 자체 브라우저 감사</h1><p>실제 원본과 복제 화면을 1440×900 Chromium으로 캡처합니다. 성공과 실패를 구분해 표시합니다.</p><p><b>상태: '+esc(state.status)+'</b> · '+esc(state.finishedAt||state.startedAt||'')+' <button onclick="fetch(\'/run\').then(()=>location.reload())">다시 실행</button> <a href="/report">전체 JSON</a></p><table><tr><th>대상</th><th>상태</th><th>HTTP</th><th>제목</th><th>이미지 수</th></tr>'+stages+'</table><h3>원본/재현 이미지 픽셀 차이</h3><pre>'+esc(asJson(state.difference))+'</pre><div class="cols"><div class="box"><h2>숨고 원본</h2><img src="/artifacts/original.png" onerror="this.replaceWith(document.createTextNode(\'원본 캡처 없음\'))"></div><div class="box"><h2>우리 재현 화면</h2><img src="/artifacts/clone.png" onerror="this.replaceWith(document.createTextNode(\'복제 캡처 없음\'))"></div></div><div class="box"><h2>픽셀 차이 이미지</h2><img src="/artifacts/diff.png"></div><div class="box"><h2>도구 설치/실행 확인</h2><pre>'+esc(asJson(state.toolStatus))+'</pre></div><div class="box"><h2>수집 데이터</h2><a href="/artifacts/original.json">원본 DOM·이미지·CSS·네트워크</a> | <a href="/artifacts/search.json">원본 검색</a> | <a href="/artifacts/clone.json">우리 화면</a></div></html>'}
const mime=(name)=>fileMap.get(name);
const server=http.createServer(async(req,res)=>{
try{const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');if(u.pathname==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ready')}
if(u.pathname==='/categories'){const htmlData=await fs.readFile('/app/categories.html');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(htmlData)}
if(u.pathname==='/clone'){const htmlData=await fs.readFile('/app/clone.html');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(htmlData)}
if(u.pathname==='/run'){const accepted=await runAudit();res.writeHead(202,{'Content-Type':'application/json'});return res.end(asJson({accepted,state:state.status}))}
if(u.pathname.startsWith('/image-base64/')){const name=u.pathname.slice('/image-base64/'.length);if(!['original.png','clone.png','diff.png','search.png','categoriesOriginal.png','categoriesClone.png','categoriesDiff.png'].includes(name)){res.writeHead(404);return res.end('Not allowed')}const data=await fs.readFile(path.join(BASE,name));res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end(data.toString('base64'))}
if(u.pathname==='/tools-run'){res.writeHead(202,{'Content-Type':'application/json'});res.end('{"accepted":true,"target":"daangn.com"}');auditTools().catch(e=>console.error('mcp_rea_audit',e));return}
if(u.pathname==='/tools-report'){const data=await fs.readFile(path.join(BASE,'tools-report.json'));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(data)}
if(u.pathname==='/report'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(asJson(state))}
if(u.pathname.startsWith('/artifacts/')){const name=u.pathname.slice(11);if(!mime(name)){res.writeHead(404);return res.end('File not allowed')}const data=await fs.readFile(path.join(BASE,name));res.writeHead(200,{'Content-Type':mime(name)});return res.end(data)}
if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html())}
res.writeHead(404);res.end('Not found');
}catch(e){res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(limit(e.message,500))}});
server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>{console.log('HITEL Soomgo Auditor ready',process.env.PORT||8080);setTimeout(()=>runAudit().catch(e=>console.error('audit',e)),1800)});
