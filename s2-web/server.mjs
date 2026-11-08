import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('./index.html',import.meta.url));
const server=createServer((req,res)=>{
 if(req.url==='/health'||req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',service:'hitel-s2-platform',demo:true,backendConnected:false}));}
 if((req.url==='/'||req.url?.startsWith('/?')||req.url==='/index.html')&&['HEAD','GET'].includes(req.method)){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','Content-Length':html.length,'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});return res.end(req.method==='HEAD'?undefined:html);
 }res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('HITEL S2 Railway UI server started'));
