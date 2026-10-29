import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';

const wss=new WebSocketServer({noServer:true,maxPayload:90*1024*1024});
let runner=null;
const browsers=new Map();
const pending=new Map();
const send=(ws,value)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));};

export function wsScrcpyOnline(){return runner?.readyState===WebSocket.OPEN;}
export function wsScrcpyUpgrade(server,{origin,allowedTicket}){
 server.on('upgrade',async(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/ws-scrcpy/'))return;
  if(url.pathname==='/ws-scrcpy/tunnel'){
   const ticket=String(req.headers['x-runner-ticket']||'');
   if(!allowedTicket(ticket)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
   wss.handleUpgrade(req,socket,head,ws=>{
    if(runner&&runner!==ws)runner.close(1012,'runner replaced');
    runner=ws;ws.on('close',()=>{if(runner===ws)runner=null;});
    ws.on('message',(raw,isBinary)=>{
     if(isBinary){
      if(raw.length<38||raw[0]!==2)return;
      const id=raw.toString('ascii',1,37),browser=browsers.get(id);
      if(browser?.readyState===WebSocket.OPEN)browser.send(raw.subarray(38),{binary:raw[37]===1});
      return;
     }
     let m;try{m=JSON.parse(raw.toString())}catch{return}
     if(m.type==='http-result'){
      const job=pending.get(m.id);if(!job)return;pending.delete(m.id);clearTimeout(job.timer);job.resolve(m);
     }else if(m.type==='ws-opened'){
      const browser=browsers.get(m.id);if(!browser)return;
      if(m.error){browser.close(1011,'device websocket failed');browsers.delete(m.id);}
     }else if(m.type==='ws-close'){
      browsers.get(m.id)?.close(1000,'device stream closed');browsers.delete(m.id);
     }
    });
   });
   return;
  }
  if(url.pathname==='/ws-scrcpy/device'){
   if(req.headers.origin!==origin){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
   if(!wsScrcpyOnline()){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
   wss.handleUpgrade(req,socket,head,ws=>{
    const id=randomUUID();browsers.set(id,ws);send(runner,{type:'ws-open',id,path:url.search});
    ws.on('message',(data,isBinary)=>{
     const header=Buffer.allocUnsafe(38);header[0]=1;header.write(id,1,36,'ascii');header[37]=isBinary?1:0;
     runner.send(Buffer.concat([header,Buffer.from(data)]),{binary:true});
    });
    ws.on('close',()=>{browsers.delete(id);send(runner,{type:'ws-close',id});});
    ws.on('error',()=>{browsers.delete(id);send(runner,{type:'ws-close',id});});
   });
   return;
  }
  socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
 });
}

export async function wsScrcpyHttp(method,path,headers,body){
 if(!wsScrcpyOnline())return {status:503,headers:{'content-type':'text/plain'},body:Buffer.from('Android relay is offline')};
 const id=randomUUID();
 const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('ANDROID_RELAY_TIMEOUT'));},45000);
  pending.set(id,{resolve,reject,timer});
  send(runner,{type:'http-request',id,method,path,headers,body:body?.toString('base64')||''});
 });
 return {status:Number(result.status)||502,headers:result.headers||{},body:Buffer.from(result.body||'','base64')};
}
