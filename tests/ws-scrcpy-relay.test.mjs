import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
import {wsScrcpyHttp,wsScrcpyUpgrade} from '../sandbox-control/ws-scrcpy-relay.mjs';

test('Railway reverse relay forwards HTTP and raw WebSocket frames',async t=>{
 const device=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('device:'+req.url)});
 const deviceWss=new WebSocketServer({noServer:true});
 device.on('upgrade',(req,socket,head)=>deviceWss.handleUpgrade(req,socket,head,ws=>
  ws.on('message',data=>ws.send(Buffer.concat([Buffer.from('device:'),data])))));
 device.listen(0,'127.0.0.1');await once(device,'listening');
 const relay=http.createServer();wsScrcpyUpgrade(relay,{origin:'https://test.local',allowedTicket:x=>x==='test-ticket'});
 relay.listen(0,'127.0.0.1');await once(relay,'listening');
 const port=relay.address().port,devicePort=device.address().port;
 const runner=new WebSocket(`ws://127.0.0.1:${port}/ws-scrcpy/tunnel`,{headers:{'x-runner-ticket':'test-ticket'}});
 const devices=new Map();
 runner.on('message',(raw,isBinary)=>{
  if(isBinary){
   if(raw.length<38||raw[0]!==1)return;
   const id=raw.toString('ascii',1,37),entry=devices.get(id);if(!entry)return;
   const frame={data:raw.subarray(38),binary:raw[37]===1};
   if(entry.socket.readyState===WebSocket.OPEN)entry.socket.send(frame.data,{binary:frame.binary});else entry.queue.push(frame);
   return;
  }
  const message=JSON.parse(raw.toString());
  if(message.type==='http-request')runner.send(JSON.stringify({type:'http-result',id:message.id,status:200,
   headers:{'content-type':'text/plain'},body:Buffer.from('runner:'+message.path).toString('base64')}));
  if(message.type==='ws-open'){
   const entry={socket:new WebSocket(`ws://127.0.0.1:${devicePort}${message.path}`),queue:[]};devices.set(message.id,entry);
   entry.socket.on('open',()=>{
    runner.send(JSON.stringify({type:'ws-opened',id:message.id}));
    for(const frame of entry.queue)entry.socket.send(frame.data,{binary:frame.binary});entry.queue=[];
   });
   entry.socket.on('message',(data,isBinary)=>{
    const header=Buffer.allocUnsafe(38);header[0]=2;header.write(message.id,1,36,'ascii');header[37]=isBinary?1:0;
    runner.send(Buffer.concat([header,Buffer.from(data)]),{binary:true});
   });
  }
 });
 await once(runner,'open');
 t.after(()=>{for(const entry of devices.values())entry.socket.terminate();runner.terminate();relay.close();device.close();deviceWss.close();});

 const response=await wsScrcpyHttp('GET','/index.html',{},Buffer.alloc(0));
 assert.equal(response.status,200);assert.equal(response.body.toString(),'runner:/index.html');
 const browser=new WebSocket(`ws://127.0.0.1:${port}/ws-scrcpy/device?action=stream`,{origin:'https://test.local'});
 await once(browser,'open');
 const echoed=once(browser,'message');browser.send(Buffer.from([0x00,0x01,0xff]),{binary:true});
 const [frame,isBinary]=await echoed;assert.equal(isBinary,true);assert.equal(frame.toString(),'device:\u0000\u0001�');
 browser.terminate();
});
