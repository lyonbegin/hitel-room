#!/usr/bin/env node
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(dir,'../../mobile-test-results/android-browser-mcp');
await fs.mkdir(output,{recursive:true});
const repoStatus='https://hitel-device-relay-production.up.railway.app/lab-api/android-native/status';
const sdk='https://hitel-communication-web-production.up.railway.app/sdk-lab';
const report={at:new Date().toISOString(),actualMcpTools:{},invocations:[],status:{},layout:{}};
function note(label,value){console.log('HITEL_MCP_'+label+'='+JSON.stringify(value).slice(0,4500));}
function content(result){return (result?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');}
function ensure(res,name){if(res?.isError)throw Error(name+' MCP error '+content(res).slice(0,1500));return res;}
async function start(name,args){
 const transport=new StdioClientTransport({command:'npx',args,cwd:dir,env:{...process.env,CI:'true',CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS:'1',CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS:'1'}});
 const client=new Client({name:'hitel-native-browser-check',version:'1.0.0'},{capabilities:{}});
 await client.connect(transport);
 const {tools=[]}=await client.listTools();
 report.actualMcpTools[name]=tools.map(t=>t.name);
 note(name.toUpperCase()+'_TOOLS',tools.map(t=>t.name));
 return {client,tools};
}
async function run(s,name,args={},required=true){
 const def=s.tools.find(x=>x.name===name);
 if(!def){if(required)throw Error(name+' tool not exposed');return null;}
 const res=await s.client.callTool({name,arguments:args});
 report.invocations.push({name,ok:!res.isError,text:content(res).slice(0,1100)});
 note('CALLED_'+name.toUpperCase(),{ok:!res.isError,text:content(res).slice(0,500)});
 if(required)ensure(res,name);
 return res;
}
async function picture(result,name){
 const img=result?.content?.find(c=>c.type==='image'&&c.data);
 if(!img)return null;
 const filename=path.join(output,name);await fs.writeFile(filename,Buffer.from(img.data,'base64'));return filename;
}
async function analyze(filename){
 if(!filename)return {hasPixels:false,reason:'MCP screenshot did not return image'};
 const png=PNG.sync.read(await fs.readFile(filename));
 let loX=png.width,loY=png.height,hiX=-1,hiY=-1;
 for(let y=0;y<png.height;y+=2)for(let x=0;x<png.width;x+=2){
   const p=(y*png.width+x)*4;
   if(Math.max(png.data[p],png.data[p+1],png.data[p+2])>32&&png.data[p+3]>180){
     loX=Math.min(loX,x);loY=Math.min(loY,y);hiX=Math.max(hiX,x);hiY=Math.max(hiY,y);
   }
 }
 return {hasPixels:hiX>=0,screenWidth:png.width,screenHeight:png.height,
  nonBlackWidth:hiX>=0?hiX-loX+1:0,nonBlackHeight:hiY>=0?hiY-loY+1:0,
  nonBlackWidthFraction:hiX>=0?+((hiX-loX+1)/png.width).toFixed(3):0,
  nonBlackHeightFraction:hiY>=0?+((hiY-loY+1)/png.height).toFixed(3):0};
}
let pw,chrome;
try{
 pw=await start('playwright',['--no-install','@playwright/mcp','--headless','--no-sandbox','--browser','chromium',...(process.env.HITEL_CHROME_PATH?['--executable-path',process.env.HITEL_CHROME_PATH]:[])]);
 chrome=await start('chrome-devtools',['--no-install','chrome-devtools-mcp','--browser-url=http://127.0.0.1:9222','--no-usage-statistics','--no-performance-crux']);
 await run(pw,'browser_navigate',{url:sdk});
 const layout=await run(pw,'browser_evaluate',{function:'() => ({title:document.title,frames:[...document.querySelectorAll("iframe")].map(f=>({src:f.src,width:f.getBoundingClientRect().width,height:f.getBoundingClientRect().height})),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}})'});
 report.layout.playwright=content(layout).slice(0,4500);
 await picture(await run(pw,'browser_take_screenshot',{},false),'railway-sdk.png');
 const response=await fetch(repoStatus);
 const status=await response.json();
 report.status={http:response.status,online:status.online,transport:status.transport};
 note('LIVE_RELAY',report.status);
 const target=status.online&&typeof status.url==='string'?status.url+'/stream/1/phone.html':sdk;
 const created=await run(chrome,'new_page',{url:target});
 const pageCandidates=[...content(created).matchAll(/(?:^|\n)(\d+):[^\n]*\[selected\]/g)];
 const pageId=pageCandidates.length?Number(pageCandidates.at(-1)[1]):null;
 if(!pageId)throw Error('CHROME_DEVTOOLS_SELECTED_PAGE_ID_MISSING:'+content(created).slice(0,600));
 note('CHROME_PAGE_ID',pageId);
 // Match the real portrait phone panel. A landscape browser viewport would
 // create artificial black letterboxing and a false undersizing diagnosis.
 if(status.online)await run(chrome,'resize_page',{pageId,width:440,height:880},false);
 const evaluation=chrome.tools.find(t=>t.name==='evaluate_script');
 const evalField=evaluation.inputSchema?.properties?.function?'function':'script';
 const result=await run(chrome,'evaluate_script',{pageId,[evalField]:'() => {const e=document.querySelector("#screen"),c=document.querySelector("canvas");const rect=x=>x?{x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}:null;return {url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},screen:rect(e),canvas:rect(c),canvases:document.querySelectorAll("canvas").length};}'});
 report.layout.chrome=content(result).slice(0,4500);
 const shot=await run(chrome,'take_screenshot',{pageId,format:'png'},false);
 report.layout.pixels=await analyze(await picture(shot,'chrome-native.png'));
 if(status.online&&process.env.HITEL_MCP_TEST_INPUT==='1'){
  // Real Chrome input, delivered through the original noVNC WebSocket to
  // X11 -> scrcpy. A harmless status-bar click followed by Android Back.
  // Never use a fabricated DOM event as proof of real touch.
  const click=await run(chrome,'click_at',{pageId,x:25,y:25},false);
  const back=await run(chrome,'press_key',{pageId,key:'Escape'},false);
  results.layout.nativeInput={
   clickMcpSuccess:!!click&&!click.isError,
   keyboardMcpSuccess:!!back&&!back.isError
  };
  note('REAL_NOVNC_BROWSER_INPUT',results.layout.nativeInput);
 }
 note('SCREEN_GEOMETRY',report.layout);
 await run(chrome,'list_console_messages',{pageId},false);
 await run(chrome,'list_network_requests',{pageId},false);
 if(status.online&&report.layout.pixels.hasPixels&&report.layout.pixels.nonBlackWidthFraction<0.65){
  report.layout.problem='NATIVE_ANDROID_SCREEN_TOO_SMALL';
  note('ACTUAL_PROBLEM',report.layout.problem);
 }
 if(!pw.tools.some(x=>x.name==='browser_navigate')||!chrome.tools.some(x=>x.name==='evaluate_script'))throw Error('MCP tools did not expose required browser operations');
 note('RESULT',status.online?'TWO_REAL_MCP_SERVERS_AND_NATIVE_SCREEN_INSPECTED':'TWO_REAL_MCP_SERVERS_WORKED_BUT_ANDROID_NOT_ONLINE');
}finally{
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 await chrome?.client?.close().catch(()=>{});
 await pw?.client?.close().catch(()=>{});
}
