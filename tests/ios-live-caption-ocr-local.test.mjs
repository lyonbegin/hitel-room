// Local, isolated protocol verification. No real iPhone, audio or screenshot
// is claimed. Tests authorization and routing of existing broadcast OCR messages.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {WebSocket} from "ws";

const folder=mkdtempSync(join(tmpdir(),"hitel-call-ocr-"));
const port=45895;
const origin="http://127.0.0.1:"+port;
process.env.HITEL_WEB_ORIGIN=origin;
process.env.HITEL_PHYSICAL_IOS_STATE_FILE=join(folder,"sessions.json");
const {physicalIphoneRoute,physicalIphoneUpgrade}=await import("../sandbox-control/physical-iphone.mjs");

const server=createServer((req,res)=>{
 const pathname=new URL(req.url,origin).pathname.replace(/^\/lab-sandbox/,"");
 void physicalIphoneRoute(req,res,pathname);
});
server.on("upgrade",(req,socket,head)=>{
 req.url=req.url.replace(/^\/lab-sandbox/,"");
 if(!physicalIphoneUpgrade(req,socket,head))socket.destroy();
});
await new Promise(resolve=>server.listen(port,"127.0.0.1",resolve));
const API=origin+"/lab-sandbox/physical-iphone";
const http=async(endpoint,payload,withOrigin=true)=>{
 const res=await fetch(API+endpoint,{method:"POST",
 headers:{"content-type":"application/json",...(withOrigin?{"origin":origin}:{})},
 body:JSON.stringify(payload)});
 const value=await res.json();
 if(!res.ok)throw Error("HTTP "+res.status+" "+JSON.stringify(value));
 return value;
};
const connect=(url,headers={})=>new Promise((resolve,reject)=>{
 const ws=new WebSocket(url,{headers});
 ws.once("error",reject);
 ws.once("open",()=>{ws.removeListener("error",reject);resolve(ws)});
});
const onceJSON=(ws,type)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off("message",onMessage);reject(Error("event missing: "+type))},7000);
 const onMessage=(bytes,binary)=>{
  if(binary)return;
  let parsed;try{parsed=JSON.parse(String(bytes))}catch{return}
  if(parsed.type!==type)return;
  clearTimeout(timer);ws.off("message",onMessage);resolve(parsed);
 };
 ws.on("message",onMessage);
});
let viewer,device,token;
try{
 const session=await http("/session",{});
 token=session.viewerToken;
 assert.match(token,/^[a-f0-9]{64}$/);
 const prepared=await http("/prepare",{code:session.pairCode},false);
 assert.equal(prepared.prepared,true);
 const endpoint="ws://127.0.0.1:"+port+"/lab-sandbox/physical-iphone/socket";
 viewer=await connect(endpoint+"?role=viewer&viewerToken="+token,{origin});
 device=await connect(endpoint+"?role=trial");
 const eventAfterApproval=onceJSON(viewer,"caption.ocr");
 const pairedPromise=onceJSON(device,"paired");
 const approved=await http("/approve",{viewerToken:token});
 assert.equal(approved.approved,true);
 await pairedPromise;
 device.send(JSON.stringify({
  type:"caption.ocr",source:"apple-live-captions-visual-ocr",
  text:"안녕하세요, 다음 주 수요일에 뵙겠습니다.",timestamp:new Date().toISOString()
 }));
 const caption=await eventAfterApproval;
 assert.equal(caption.text,"안녕하세요, 다음 주 수요일에 뵙겠습니다.");
 assert.equal(caption.source,"apple-live-captions-visual-ocr");
 assert.equal(caption.sequence,1);
 const repeatJoin=new WebSocket(endpoint+"?role=viewer&viewerToken="+token,{headers:{origin}});
 const latestPromise=onceJSON(repeatJoin,"caption.ocr");
 await new Promise((resolve,reject)=>{repeatJoin.once("open",resolve);repeatJoin.once("error",reject)});
 // The server sends current status then recent caption so a foreground app
 // can catch up after Phone.app was in front.
 const latest=await latestPromise;
 assert.equal(latest.text,caption.text);
 repeatJoin.close();
 console.log("HITEL_LIVE_CAPTION_OCR_AUTHORIZED_RELAY_PASS");
 console.log("HITEL_LIVE_CAPTION_OCR_RESUME_LAST_TEXT_PASS");
 console.log("TEST_ONLY_NO_PHYSICAL_PHONE_FRAMES");
}finally{
 if(token)try{await http("/stop",{viewerToken:token})}catch{}
 viewer?.close();device?.close();
 await new Promise(resolve=>server.close(resolve));
 rmSync(folder,{recursive:true,force:true});
}
