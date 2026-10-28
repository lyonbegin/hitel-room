// Zero-reencode HTTP/WebSocket gateway for the original ws-scrcpy daemon.
// The GitHub KVM runner runs it only during the disposable Android session.
// Cloudflare Quick Tunnel (when explicitly enabled) points at localhost:8081.
// Do not serve file management or unauthenticated permanent Android endpoints.
import http from 'node:http';
import net from 'node:net';
const BIND='127.0.0.1',PORT=8081,UPSTREAM=8000;
const ALLOWED_ORIGIN='https://hitel-communication-web-production.up.railway.app';
const stopAfterMs=600000;
let requests=0,websockets=0;
const server=http.createServer((req,res)=>{
 if(req.url?.split('?')[0]==='/__hitel_ws_scrcpy'){
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store',
   'access-control-allow-origin':ALLOWED_ORIGIN});
  res.end(JSON.stringify({ok:true,engine:'ws-scrcpy',protocol:'h264-websocket',
    androidVersion:'11',vnc:false,uptime:Math.round(process.uptime())}));return;
 }
 requests++;
 const headers={...req.headers,host:'127.0.0.1:8000'};
 const proxy=http.request({hostname:BIND,port:UPSTREAM,path:req.url||'/',method:req.method,headers},upstream=>{
  res.writeHead(upstream.statusCode||502,upstream.headers);
  upstream.pipe(res);
 });
 proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Device stream unavailable');});
 req.pipe(proxy);
});
server.on('upgrade',(req,client,head)=>{
 const origin=req.headers.origin||'';
 // Web browser clients must be same-origin with the random Quick Tunnel host.
 if(origin){
  try{if(new URL(origin).host!==req.headers.host)throw Error('cross-origin')}
  catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return}
 }
 websockets++;
 const upstream=net.connect(UPSTREAM,BIND,()=>{
  const headers={...req.headers,host:'127.0.0.1:8000'};
  const lines=Object.entries(headers).flatMap(([key,v])=>
   Array.isArray(v)?v.map(s=>key+': '+s):v===undefined?[]:[key+': '+v]);
  upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+lines.join('\r\n')+'\r\n\r\n');
  if(head.length)upstream.write(head);
  client.pipe(upstream);upstream.pipe(client);
 });
 const close=()=>{client.destroy();upstream.destroy()};
 upstream.on('error',close);client.on('error',close);
});
server.listen(PORT,BIND,()=>console.log('HITEL_WS_SCRCPY_GATEWAY_READY',PORT,'video=noVNC-free'));
const timer=setTimeout(()=>{console.log('HITEL_WS_SCRCPY_GATEWAY_TTL_EXPIRED',requests,websockets);server.close();process.exit(0)},stopAfterMs);
timer.unref();
