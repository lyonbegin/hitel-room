import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const origin='https://soomgo.com/search/pro/%EC%9D%B4%EC%82%AC-%EC%9E%85%EC%A3%BC-%EC%B2%AD%EC%86%8C-%EC%97%85%EC%B2%B4/%EC%84%9C%EC%9A%B8-%EC%84%B1%EB%8F%99%EA%B5%AC/%EC%9D%B4%EC%82%AC-%EC%B2%AD%EC%86%8CA--%EC%9E%85%EC%A3%BC-%EC%A7%91-%EC%B2%AD%EC%86%8CA/review_count';
const out='/tmp/hitel-soomgo-audit/tools-report.json';
const pause=n=>new Promise(r=>setTimeout(r,n));
const short=x=>String(x||'').slice(0,7000);
async function mcp(name,cmd,args){
 let client,transport;const data={status:'started',tools:[],response:null};
 try{
 transport=new StdioClientTransport({command:cmd,args,env:{...process.env,NO_COLOR:'1'}});
 client=new Client({name:'hitel-daangn-auditor',version:'1.0.0'},{capabilities:{}});
 await Promise.race([client.connect(transport),pause(18000).then(()=>{throw Error('MCP connect timeout')})]);
 const list=await client.listTools();data.tools=list.tools.map(x=>x.name);
 let desired=name==='playwright'?'browser_navigate':'new_page';
 if(!data.tools.includes(desired))desired=name==='playwright'?'browser_snapshot':'list_pages';
 const selected=list.tools.find(x=>x.name===desired);
 const argsInput=desired==='list_pages'||desired==='browser_snapshot'?{}:{url:origin};
 try{const reply=await Promise.race([client.callTool({name:desired,arguments:argsInput}),pause(42000).then(()=>{throw Error('MCP action timeout')})]);data.response=(reply.content||[]).filter(c=>c.type==='text').map(c=>short(c.text)).slice(0,2);data.status=reply.isError?'tool_error':'tool_called';}catch(e){data.status='tool_error';data.error=String(e.message||e)}
 data.action=desired;data.required=selected?.inputSchema?.required||[];
 }catch(e){data.status='failed';data.error=String(e.message||e)}
 finally{await client?.close().catch(()=>{});await transport?.close().catch(()=>{})}
 return data;
}
async function proc(cmd,args,env,timeout=20000){
 return await new Promise(resolve=>{let stdout='',stderr='',done=false;const p=spawn(cmd,args,{env,cwd:'/app',stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>{if(!done){done=true;p.kill('SIGKILL');resolve({ok:false,reason:'timeout',stdout:short(stdout),stderr:short(stderr)})}},timeout);
 p.stdout.on('data',b=>{if(stdout.length<350000)stdout+=b.toString()});p.stderr.on('data',b=>{if(stderr.length<35000)stderr+=b.toString()});
 p.on('error',e=>{if(!done){done=true;clearTimeout(timer);resolve({ok:false,reason:String(e)})}});
 p.on('close',code=>{if(!done){done=true;clearTimeout(timer);resolve({ok:code===0,exitCode:code,stdout:stdout.slice(0,350000),stderr:stderr.slice(0,35000)})}})});
}
async function rea(){
 const port=9333,url='http://127.0.0.1:'+port,profile='/tmp/hitel-rea-'+Date.now();
 const chrome=spawn(chromium.executablePath(),['--no-sandbox','--headless=new','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+profile,origin],{stdio:'ignore'});
 const env={...process.env,NO_COLOR:'1',REA_BROWSER_OBSERVE_ENABLED:'true',REA_BROWSER_CDP_ENDPOINTS_JSON:JSON.stringify([url]),REA_BROWSER_ALLOWED_ORIGINS_JSON:JSON.stringify(['https://soomgo.com'])};
 try{await pause(6000);let listing=await proc('./node_modules/.bin/rea',['list-browser-targets',url,'--json'],env,30000);let result={status:listing.ok?'targets_listed':'failed',discovery:{ok:listing.ok,exitCode:listing.exitCode,out:short(listing.stdout),err:short(listing.stderr)}};
 if(!listing.ok)return result;let targetID=null;try{const x=JSON.parse(listing.stdout);const rows=x.normalized_result?.targets||x.targets||x.data?.targets||x.result?.targets||x.data?.pages||[];targetID=rows.find(t=>String(t.url||'').includes('soomgo.com'))?.target_id||rows.find(t=>String(t.url||'').includes('soomgo.com'))?.id||rows.find(t=>String(t.url||'').includes('soomgo.com'))?.targetId||null;if(!targetID){const m=listing.stdout.match(/"id"\s*:\s*"([^"]+)"[\s\S]{0,200}daangn/);targetID=m?.[1]||null}}catch(e){result.parseError=String(e)}
 result.targetId=targetID;if(!targetID)return result;
 const inspected=await proc('./node_modules/.bin/rea',['inspect-web-page',url,targetID,'--observation-ms','0','--json'],env,35000);result.status=inspected.ok?'inspected':'inspect_failed';result.inspection={ok:inspected.ok,exitCode:inspected.exitCode,out:short(inspected.stdout),err:short(inspected.stderr)};return result;
 }finally{chrome.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true}).catch(()=>{})}
}
export async function auditTools(){
 await fs.mkdir('/tmp/hitel-soomgo-audit',{recursive:true});
 const result={status:'running',startedAt:new Date().toISOString(),steps:{}};
 const save=async()=>await fs.writeFile(out,JSON.stringify(result,null,2));
 await save();
 try{
 result.steps.playwrightMCP=await mcp('playwright','/app/node_modules/.bin/playwright-mcp',['--headless','--browser','chromium','--no-sandbox','--isolated','--executable-path',chromium.executablePath()]);await save();
 result.steps.chromeDevToolsMCP=await mcp('chrome','/app/node_modules/.bin/chrome-devtools-mcp',['--headless=true','--isolated=true','--executablePath',chromium.executablePath(),'--chromeArg=--no-sandbox','--chromeArg=--disable-dev-shm-usage']);await save();
 result.steps.REA=await rea();await save();
 result.status='finished';
 }catch(e){result.status='failed';result.error=String(e.message||e)}
 result.finishedAt=new Date().toISOString();await save();return result;
}
