const http=require('http'),{spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');let seq=0;
const port=Number(process.env.PORT||8080);
const allowed=new Set(['/','/events','/hospitals','/community','/contents','/events/6554','/hospitals/250','/search?q=%EB%A6%AC%ED%94%84%ED%8C%85','/search?category=%EB%A6%AC%ED%94%84%ED%8C%85','/contents/3f9d9338-d3d4-80da-916a-f41425fe332d']);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/health'){res.end('ready');return;}
 if(url.pathname!=='/capture'){res.writeHead(404);res.end('Not found');return;}
 const targetPath=url.searchParams.get('path')||'/';
 const site=url.searchParams.get('site')==='clone'?'https://unni-pc-clone-production.up.railway.app':'https://unni.app';
 if(!allowed.has(targetPath)){res.writeHead(400);res.end('Path not allowed');return;}
 const id=++seq,file=path.join(os.tmpdir(),'review-'+Date.now()+'-'+id+'.png');
 const proc=spawn('chromium',['--no-sandbox','--headless=new','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--window-size=1440,1200','--virtual-time-budget=8500','--screenshot='+file,site+targetPath],{stdio:['ignore','ignore','pipe']});let stderr='';
 proc.stderr.on('data',b=>stderr+=b.toString().slice(0,1000));let done=false;
 const timer=setTimeout(()=>{if(done)return;done=true;proc.kill('SIGKILL');res.writeHead(504);res.end('Capture timed out')},49000);
 proc.on('close',code=>{if(done)return;done=true;clearTimeout(timer);if(!fs.existsSync(file)){res.writeHead(502);res.end('Failed '+code+': '+stderr.slice(-700));return;}res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});fs.createReadStream(file).pipe(res);res.on('finish',()=>fs.unlink(file,()=>{}));});
}).listen(port,'0.0.0.0',()=>console.log('visual verification server',port));
