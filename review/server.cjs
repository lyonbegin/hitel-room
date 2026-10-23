const http=require('http'),{spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
let sequence=0;
const port=Number(process.env.PORT||8080);
const permit=(p)=>{if(typeof p!=='string'||p.length>420||!p.startsWith('/')||p.startsWith('//'))return false;const route=new URL(p,'https://unni.app');return /^\/$|^\/events(?:\/\d+)?$|^\/hospitals(?:\/\d+)?$|^\/doctors\/\d+$|^\/contents(?:\/[a-z0-9-]+)?$|^\/community$|^\/search$|^\/district-filter$/.test(route.pathname);};
function runChrome(args,timeout,callback){let stderr='',stdout='',done=false;const proc=spawn('chromium',['--no-sandbox','--headless=new','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--window-size=1440,1200','--virtual-time-budget=6500',...args],{stdio:['ignore','pipe','pipe']});proc.stdout.on('data',v=>{if(stdout.length<3500000)stdout+=v.toString()});proc.stderr.on('data',v=>{if(stderr.length<4000)stderr+=v.toString()});const timer=setTimeout(()=>{if(done)return;done=true;proc.kill('SIGKILL');callback({error:'Timeout',stderr})},timeout);proc.on('close',code=>{if(done)return;done=true;clearTimeout(timer);callback({code,stdout,stderr})});proc.on('error',e=>{if(done)return;done=true;clearTimeout(timer);callback({error:String(e)})});}
const count=(s,r)=>(s.match(r)||[]).length;
const summaries=html=>({title:html.match(/<title>([^<]+)/i)?.[1]||'',htmlLength:html.length,bodyText:html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,480),eventCards:count(html,/class="event-card"/g),eventRows:count(html,/class="source-event-row"/g),hospitals:count(html,/class="hospital-card"/g),articles:count(html,/class="editorial-card"/g),curation:count(html,/class="site-section curated-source"/g),communityPosts:count(html,/class="source-community-item"/g),menuItems:count(html,/class="source-bottom-icon"/g),categoryTabs:count(html,/data-to="\/events\?q=/g),eventLinks:[...html.matchAll(/data-to="\/events\/(\d+)"/g)].map(m=>m[1]).slice(0,30),hospitalsLinks:[...html.matchAll(/data-to="\/hospitals\/(\d+)"/g)].map(m=>m[1]).slice(0,25),brokenImages:count(html,/class="[^"]*\bbroken-img\b[^"]*"/g),brokenImageSources:[...html.matchAll(/class="[^"]*\bbroken-img\b[^"]*"/g)].slice(0,8).map(m=>html.slice(m.index,m.index+1600).match(/<img[^>]*src="([^"]+)"/)?.[1]||'').filter(Boolean)});
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/health'){res.end('ready');return;}
 if(!['/capture','/inspect'].includes(url.pathname)){res.writeHead(404);res.end('Not found');return;}
 const targetPath=url.searchParams.get('path')||'/';if(!permit(targetPath)){res.writeHead(400);res.end('Path not allowed');return;}
 const site=url.searchParams.get('site')==='original'?'https://unni.app':'https://unni-pc-clone-production.up.railway.app';
 const target=site+targetPath;
 if(url.pathname==='/inspect'){
  return runChrome(['--dump-dom',target],48000,result=>{
   const output=result.stdout||'';res.writeHead(result.error?502:200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(url.searchParams.get('compact')==='1'?{url:target,...((({brokenImages,brokenImageSources,eventCards,eventRows,hospitals,articles,communityPosts,curation,menuItems,categoryTabs})=>({brokenImages,brokenImageSources,eventCards,eventRows,hospitals,articles,communityPosts,curation,menuItems,categoryTabs}))(summaries(output))),error:result.error||null}:{url:target,...summaries(output),errors:(result.stderr||'').split('\n').filter(x=>/ERR_|Uncaught|ERROR/i.test(x)).slice(0,8),error:result.error||null}));
  });
 }
 const id=++sequence,file=path.join(os.tmpdir(),'review-'+Date.now()+'-'+id+'.png');
 runChrome(['--screenshot='+file,target],48000,result=>{
  if(!fs.existsSync(file)){res.writeHead(502);res.end(result.error||'Screenshot failed');return;}
  if(url.searchParams.get('emit')==='diagnostic'){const data=fs.readFileSync(file).toString('base64');const key='AUDIT'+id;console.log('IMAGE_START:'+key+':'+data.length);for(let n=0;n<data.length;n+=4500)console.log('IMAGE_PART:'+key+':'+Math.floor(n/4500)+':'+data.slice(n,n+4500));console.log('IMAGE_END:'+key);}
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});fs.createReadStream(file).pipe(res);res.on('finish',()=>fs.unlink(file,()=>{}));
 });
}).listen(port,'0.0.0.0',()=>console.log('visual audit /inspect and /capture',port));
