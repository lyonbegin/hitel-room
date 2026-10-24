/**
 * Actual MCP client (not plain Playwright): starts Microsoft's Playwright MCP
 * and Google's Chrome DevTools MCP as independent stdio servers. Calls their
 * real tools against production HITEL, retains a machine-readable transcript,
 * and never creates extra Android device sessions.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('mobile-test-results/browser-mcp');
await fs.mkdir(root,{recursive:true});
const TARGET=process.env.HITEL_TARGET_URL||'https://hitel-communication-web-production.up.railway.app/sdk-lab';
const expectedHostname=new URL(TARGET).hostname;
if(expectedHostname!=='hitel-communication-web-production.up.railway.app')
  throw Error('Browser MCP test is restricted to the actual HITEL Railway hostname');
const summary={target:TARGET,started:new Date().toISOString(),checks:[],serverTools:{},images:[],errors:[]};
const check=(label,data)=>{summary.checks.push({label,data});console.log('MCP_CHECK',label,JSON.stringify(data).slice(0,1500))};
async function save(name,result){
  const contents=result?.content||[];
  let details=[];
  for(let i=0;i<contents.length;i++){
    const c=contents[i];
    if(c.type==='image'&&c.data){
      const file=name+'-'+i+'.'+(c.mimeType?.includes('jpeg')?'jpg':'png');
      await fs.writeFile(path.join(root,file),Buffer.from(c.data,'base64'));
      summary.images.push(file);details.push({type:'image',file});
    } else if(c.type==='text')details.push({type:'text',text:c.text.slice(0,9000)});
  }
  await fs.writeFile(path.join(root,name+'.json'),JSON.stringify({
    isError:result?.isError||false,details},null,2));
  if(result?.isError)throw Error(name+' MCP tool returned isError '+JSON.stringify(details).slice(0,1000));
  return details;
}
async function setup(name,args){
  const transport=new StdioClientTransport({
    command:'npx',args:['-y',...args],cwd:process.cwd(),
    env:{...process.env,NO_COLOR:'1'}
  });
  const client=new Client({name:'hitel-browser-integration',version:'1.0.0'});
  await client.connect(transport);
  const toolset=await client.listTools();
  summary.serverTools[name]=toolset.tools.map(x=>x.name);
  check(name+'_AVAILABLE_TOOLS',summary.serverTools[name]);
  const call=async (tool,params={})=>{
    if(!summary.serverTools[name].includes(tool))throw Error(name+' missing required tool '+tool);
    const result=await client.callTool({name:tool,arguments:params});
    return await save(name+'-'+tool,result);
  };
  return {client,transport,call};
}
let pw,dev;
try{
  // Playwright MCP independently drives a REAL Chromium page.
  pw=await setup('playwright',['@playwright/mcp@latest','--headless','--browser=chromium','--isolated','--viewport-size=1440,960']);
  const opened=await pw.call('browser_navigate',{url:TARGET});
  check('PLAYWRIGHT_PAGE_OPENED',opened);
  const snap=await pw.call('browser_snapshot');
  check('PLAYWRIGHT_DOM_SNAPSHOT',snap);
  await pw.call('browser_take_screenshot',{type:'png',fullPage:true,filename:path.join(root,'playwright-full.png')});

  // A separate REAL headless Chrome inspected through Chrome DevTools MCP.
  dev=await setup('devtools',['chrome-devtools-mcp@latest','--headless','--isolated','--no-usage-statistics']);
  const pages=await dev.call('list_pages');
  check('CHROME_PAGES',pages);
  const nav=await dev.call('navigate_page',{url:TARGET});
  check('CHROME_NAVIGATION',nav);
  const evalResult=await dev.call('evaluate_script',{function:`async () => {
    const names=['/lab-api/android-native/status','/lab-api/apk/ui/status'];
    const endpoints=await Promise.all(names.map(async endpoint=>{
      try{
        const response=await fetch(endpoint,{cache:'no-store',credentials:'same-origin'});
        return {endpoint,status:response.status,body:await response.json()};
      }catch(error){return {endpoint,error:String(error)}}
    }));
    const app=document.querySelector('#root')||document.body;
    const iframe=Array.from(document.querySelectorAll('iframe')).map(f=>({
      src:f.src,rect:{x:f.getBoundingClientRect().x,y:f.getBoundingClientRect().y,
      width:f.getBoundingClientRect().width,height:f.getBoundingClientRect().height}}));
    const buttons=Array.from(document.querySelectorAll('button')).map(x=>({
      text:x.innerText,disabled:x.disabled}));
    return {title:document.title,host:location.host,rootPresent:!!app,
      bodyText:document.body.innerText.slice(0,1800),iframes:iframe,buttons,endpoints,
      viewport:{width:innerWidth,height:innerHeight}};
  }`});
  check('CHROME_LAYOUT_AND_LIVE_ENDPOINTS',evalResult);
  await dev.call('take_screenshot',{fullPage:true});
  if(summary.images.length<1)throw Error('No actual browser screenshot from MCP tools');
  summary.result='MCP_SERVERS_EXECUTED_AND_BOTH_BROWSERS_VERIFIED';
}catch(error){
  summary.errors.push(String(error?.stack||error));
  summary.result='FAILED';
  console.error('MCP_BROWSER_VERIFICATION_FAILURE',error);
  process.exitCode=1;
}finally{
  summary.completed=new Date().toISOString();
  await fs.writeFile(path.join(root,'summary.json'),JSON.stringify(summary,null,2));
  for(const x of [pw,dev])if(x){try{await x.client.close()}catch{}try{await x.transport.close()}catch{}}
}
