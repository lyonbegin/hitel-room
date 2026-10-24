import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

/**
 * APK upload / install work queue.
 * Railway stores files and installation results; ADB is NEVER run on Railway.
 * An authenticated runner with a real emulator polls a single assigned device.
 */
export function createApkManager({
  root, adminToken=process.env.LAB_APK_ADMIN_TOKEN||'',
  agentToken=process.env.LAB_APK_AGENT_TOKEN||'',
  verifyCI=async()=>{throw Error('OIDC_NOT_CONFIGURED');},
  maxBytes=80*1024*1024
}={}){
  if(!root)throw Error('APK_STORAGE_ROOT_REQUIRED');
  const filesDir=path.join(root,'files');
  const jobsDir=path.join(root,'jobs');
  const framesDir=path.join(root,'frames');
  const hosts=new Map();
  const uiTestSessions=new Map();
  let pendingUiSession=null;
  const uiStartFile=path.join(root,'interactive-request.json');
  const starterWindows=new Map();
  async function readUiRequest(){
    try{return JSON.parse(await fs.readFile(uiStartFile,'utf8'))}
    catch{return null}
  }
  async function writeUiRequest(value){
    const tmp=uiStartFile+'.tmp';
    await fs.writeFile(tmp,JSON.stringify(value),{mode:0o600});
    await fs.rename(tmp,uiStartFile);
  }
  function cookieValue(req,name){
    return String(req.headers.cookie||'').split(';').map(x=>x.trim())
      .find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
  }
  const TEST_DEVICE='ci-playstore';
  const validId=/^[a-f0-9-]{36}$/i;
  const validDevice=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
  const json=(res,code,value)=>{
    res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
      'x-content-type-options':'nosniff'});
    res.end(JSON.stringify(value));
  };
  const unauthorized=res=>json(res,401,{ok:false,error:'AUTHORIZED_APK_OPERATOR_REQUIRED'});
  const bad=(res,error,code=400)=>json(res,code,{ok:false,error});
  const same=(a,b)=>Boolean(a&&b)&&Buffer.byteLength(a)===Buffer.byteLength(b)&&
    crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  const tokenOf=req=>(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1]||'';
  const admin=req=>same(adminToken,tokenOf(req));
  async function agent(req,device){
    if(!validDevice.test(device||''))throw Error('INVALID_DEVICE_ID');
    if(same(agentToken,tokenOf(req)))return {kind:'persistent',device};
    // OIDC credentials are accepted ONLY for disposable CI emulator id.
    if(device==='ci-android'||device==='ci-playstore'){
      const identity=await verifyCI(req);
      return {kind:'ci',device,runId:String(identity.run_id||'')};
    }
    throw Error('AUTHORIZED_EMULATOR_AGENT_REQUIRED');
  }
  const ready=Promise.all([fs.mkdir(filesDir,{recursive:true,mode:0o700}),
    fs.mkdir(jobsDir,{recursive:true,mode:0o700}),
    fs.mkdir(framesDir,{recursive:true,mode:0o700})]);
  async function readJson(req,max=4096){
    let size=0;
    const chunks=[];
    for await(const chunk of req){
      size+=chunk.length;
      if(size>max)throw Error('BODY_TOO_LARGE');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async function readRecord(dir,id){
    if(!validId.test(id))return null;
    try{return JSON.parse(await fs.readFile(path.join(dir,id+'.json'),'utf8'))}
    catch(e){if(e.code==='ENOENT')return null;throw e}
  }
  async function saveRecord(dir,record){
    const dest=path.join(dir,record.id+'.json');
    const temp=dest+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
    await fs.writeFile(temp,JSON.stringify(record),{mode:0o600});
    await fs.rename(temp,dest);
  }
  async function allRecords(dir){
    const files=(await fs.readdir(dir)).filter(name=>validId.test(name.slice(0,-5))&&name.endsWith('.json'));
    const items=await Promise.all(files.map(x=>readRecord(dir,x.slice(0,-5))));
    return items.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async function storeUpload(req,name,limit=maxBytes){
    if(!name||!name.toLowerCase().endsWith('.apk'))throw Error('APK_FILENAME_REQUIRED');
    const declared=Number(req.headers['content-length']||0);
    if(declared>limit)throw Error('APK_TOO_LARGE');
    const id=crypto.randomUUID();
    const dest=path.join(filesDir,id+'.apk');
    const hash=crypto.createHash('sha256');
    let count=0,first=Buffer.alloc(0);
    try{
      const output=createWriteStream(dest,{flags:'wx',mode:0o600});
      await pipeline(req,async function* (source){
        for await(const chunk of source){
          count+=chunk.length;
          if(count>limit)throw Error('APK_TOO_LARGE');
          if(first.length<4)first=Buffer.concat([first,chunk]).subarray(0,4);
          hash.update(chunk);yield chunk;
        }
      },output);
      if(count<100||first.toString('hex')!=='504b0304')throw Error('INVALID_APK_ZIP_HEADER');
      const record={id,filename:name.slice(0,120),size:count,sha256:hash.digest('hex'),
        createdAt:new Date().toISOString(),format:'apk'};
      await saveRecord(filesDir,record);
      return record;
    }catch(e){await fs.rm(dest,{force:true});throw e}
  }
  async function queueInstall(apkId,deviceId,launchAfterInstall){
    const file=await readRecord(filesDir,apkId);
    if(!file)throw Error('UNKNOWN_APK');
    const job={id:crypto.randomUUID(),apkId,filename:file.filename,deviceId,
      launchAfterInstall:launchAfterInstall===true,
      status:'pending',createdAt:new Date().toISOString(),error:null};
    await saveRecord(jobsDir,job);
    return job;
  }

  async function handle(req,res,url){
    const route=url.pathname;
    await ready;
    try{
      // A signed GitHub Actions runner creates a short-lived test link.
      // The operator clicks the link; there is no token field in the browser.
      // The website owns the start/stop controls; GitHub is a background worker.
      if(req.method==='POST'&&route==='/lab-api/apk/ui/start'){
        const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0];
        const old=starterWindows.get(ip)||{from:Date.now(),count:0};
        if(Date.now()-old.from>60*60_000){old.from=Date.now();old.count=0}
        if(old.count>=3)return bad(res,'TEST_LAUNCH_RATE_LIMIT',429);
        const current=await readUiRequest();
        if(current&&['queued','starting','running','stopping'].includes(current.status)&&
           Date.now()-Date.parse(current.createdAt)<40*60_000)
          return json(res,409,{ok:false,error:'EMULATOR_SESSION_ALREADY_ACTIVE'});
        old.count++;starterWindows.set(ip,old);
        const owner=crypto.randomBytes(24).toString('base64url');
        const request={id:crypto.randomUUID(),owner,status:'queued',
          createdAt:new Date().toISOString(),endedAt:null};
        await writeUiRequest(request);
        pendingUiSession=null;
        uiTestSessions.clear();
        res.setHeader('Set-Cookie','hitel_ui_owner='+owner+
          '; HttpOnly; Secure; SameSite=Strict; Path=/lab-api/apk; Max-Age=7200');
        return json(res,202,{ok:true,status:'queued',requestId:request.id,
          message:'ANDROID_LAUNCH_QUEUED'});
      }
      if(req.method==='GET'&&route==='/lab-api/apk/ui/status'){
        const current=await readUiRequest();
        if(!current)return json(res,200,{ok:true,status:'idle',online:false});
        const owner=cookieValue(req,'hitel_ui_owner');
        if(owner!==current.owner)return json(res,200,{ok:true,
          status:['queued','starting','running','stopping'].includes(current.status)?'busy':'idle',
          online:false});
        const emulator=hosts.get(TEST_DEVICE);
        const online=!!emulator&&Date.now()-emulator.lastSeen<20_000;
        const stale=Date.now()-Date.parse(current.createdAt)>35*60_000;
        return json(res,200,{ok:true,
          status:stale&&current.status!=='completed'?'expired':current.status,
          requestId:current.id,online,
          requestedAt:current.createdAt});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/ui/stop'){
        const current=await readUiRequest();
        if(!current||cookieValue(req,'hitel_ui_owner')!==current.owner)
          return bad(res,'NO_OWNED_ANDROID_SESSION',403);
        if(['queued','starting','running'].includes(current.status)){
          current.status='stopping';current.stopAt=new Date().toISOString();
          await writeUiRequest(current);
        }
        return json(res,200,{ok:true,status:current.status});
      }
      // Called by a scheduled runner using a signed GitHub Actions identity.
      if(req.method==='POST'&&route==='/lab-api/apk/ci/claim-start'){
        try{await verifyCI(req)}catch{return unauthorized(res)}
        const current=await readUiRequest();
        if(!current||current.status!=='queued'||
           Date.now()-Date.parse(current.createdAt)>30*60_000)
          return json(res,200,{ok:true,claim:false});
        current.status='starting';current.claimedAt=new Date().toISOString();
        await writeUiRequest(current);
        return json(res,200,{ok:true,claim:true,requestId:current.id});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/ci/finish'){
        try{await verifyCI(req)}catch{return unauthorized(res)}
        const current=await readUiRequest();
        if(current&&['starting','running','stopping'].includes(current.status)){
          current.status='completed';current.endedAt=new Date().toISOString();
          await writeUiRequest(current);
          uiTestSessions.clear();pendingUiSession=null;
        }
        return json(res,200,{ok:true});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/ci/ui-session'){
        let identity;
        try{identity=await verifyCI(req)}catch{return unauthorized(res)}
        const token=crypto.randomBytes(32).toString('base64url');
        for(const [key,value] of uiTestSessions)
          if(Date.now()>value.expiresAt)uiTestSessions.delete(key);
        const expiresAt=Date.now()+18*60_000;
        uiTestSessions.clear();
        uiTestSessions.set(token,{runId:String(identity.run_id||''),
          expiresAt,deviceId:TEST_DEVICE});
        const current=await readUiRequest();
        if(current&&current.status==='starting'){
          current.status='running';current.connectedAt=new Date().toISOString();
          await writeUiRequest(current);
        }
        pendingUiSession={token,expiresAt,claimed:false,owner:current?.owner||null};
        return json(res,201,{ok:true,deviceId:TEST_DEVICE,expiresInSeconds:1080});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/ui/connect'){
        // One browser claims the short-lived disposable test session.
        // No user-entered credential or workflow-log token is required.
        const origin=String(req.headers.origin||'');
        if(origin!=='https://hitel-communication-web-production.up.railway.app' &&
           origin!=='http://127.0.0.1')return bad(res,'TEST_ORIGIN_REQUIRED',403);
        const pending=pendingUiSession;
        if(pending?.owner&&cookieValue(req,'hitel_ui_owner')!==pending.owner)
          return json(res,202,{ok:true,ready:false});
        if(!pending||pending.expiresAt<=Date.now())
          return json(res,202,{ok:true,ready:false});
        if(pending.claimed){
          const existing=String(req.headers.cookie||'').split(';').map(x=>x.trim())
            .find(x=>x.startsWith('hitel_apk_test='))?.slice('hitel_apk_test='.length);
          if(existing&&existing===pending.token)return json(res,200,{ok:true,
            ready:true,deviceId:TEST_DEVICE});
          return json(res,202,{ok:true,ready:false});
        }
        pending.claimed=true;
        res.setHeader('Set-Cookie','hitel_apk_test='+pending.token+
          '; HttpOnly; Secure; SameSite=Strict; Path=/lab-api/apk; Max-Age=1080');
        return json(res,200,{ok:true,ready:true,deviceId:TEST_DEVICE,
          expiresInSeconds:Math.floor((pending.expiresAt-Date.now())/1000)});
      }
      const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim())
        .find(x=>x.startsWith('hitel_apk_test='))?.slice('hitel_apk_test='.length)||'';
      const session=uiTestSessions.get(cookie);
      const isTest=!!session&&session.expiresAt>Date.now()&&session.deviceId===TEST_DEVICE;
      if(req.method==='GET'&&route==='/lab-api/apk/health')
        return json(res,200,{ok:true,enabled:!!adminToken,mode:'APK queue + external emulator agent'});
      if(req.method==='POST'&&route==='/lab-api/apk/ci/seed'){
        try{await verifyCI(req)}catch{return unauthorized(res)}
        // This endpoint is only for a disposable GitHub Actions CI emulator.
        // A queued user APK is never replaced by the self-test sample.
        const pending=(await allRecords(jobsDir)).some(j=>
          j.deviceId==='ci-android'&&j.status==='pending');
        if(pending)return json(res,200,{ok:true,seeded:false,reason:'USER_JOB_ALREADY_QUEUED'});
        try{
          const file=await storeUpload(req,'hitel-native-ci.apk',16*1024*1024);
          const job=await queueInstall(file.id,'ci-android',true);
          return json(res,201,{ok:true,seeded:true,jobId:job.id});
        }catch(e){return bad(res,e.message,e.message==='APK_TOO_LARGE'?413:400)}
      }
      if(route.startsWith('/lab-api/apk/agent/')){
        const device=String(req.headers['x-emulator-device']||'');
        let identity;
        try{identity=await agent(req,device)}
        catch{return unauthorized(res)}
        hosts.set(device,{...hosts.get(device),deviceId:device,lastSeen:Date.now(),kind:identity.kind});
        if(req.method==='POST'&&route==='/lab-api/apk/agent/next'){
          if(device===TEST_DEVICE){
            const current=await readUiRequest();
            if(current?.status==='stopping')return json(res,200,{ok:true,stop:true,job:null});
          }
          // Choose oldest pending job. A lease prevents concurrent installers.
          const jobs=(await allRecords(jobsDir)).reverse();
          let job=jobs.find(j=>j.deviceId===device&&j.status==='pending');
          if(!job)job=jobs.find(j=>j.deviceId===device&&j.status==='installing'&&
            Date.now()-(Date.parse(j.startedAt)||0)>15*60_000);
          if(!job)return json(res,200,{ok:true,job:null});
          if(['control','store','verify'].includes(job.operation)){
            job.status='installing';job.startedAt=new Date().toISOString();job.leaseId=crypto.randomUUID();
            job.agentKind=identity.kind;await saveRecord(jobsDir,job);
            return json(res,200,{ok:true,job:{id:job.id,operation:job.operation,
              action:job.action,args:job.args,packageName:job.packageName,leaseId:job.leaseId}});
          }
          const file=await readRecord(filesDir,job.apkId);
          if(!file){job.status='failed';job.error='APK_NOT_FOUND';await saveRecord(jobsDir,job);return bad(res,'APK_NOT_FOUND',410)}
          job.status='installing';job.startedAt=new Date().toISOString();job.leaseId=crypto.randomUUID();
          job.agentKind=identity.kind;await saveRecord(jobsDir,job);
          return json(res,200,{ok:true,job:{id:job.id,operation:'install',apkId:file.id,sha256:file.sha256,
            size:file.size,filename:file.filename,leaseId:job.leaseId,
            launchAfterInstall:job.launchAfterInstall===true}});
        }
        if(req.method==='GET'&&route.startsWith('/lab-api/apk/agent/file/')){
          const jobId=route.split('/').at(-1);
          const job=await readRecord(jobsDir,jobId);
          if(!job||job.deviceId!==device||job.status!=='installing')return bad(res,'JOB_NOT_ASSIGNED',404);
          const file=await readRecord(filesDir,job.apkId);
          if(!file)return bad(res,'APK_NOT_FOUND',404);
          const bytes=await fs.readFile(path.join(filesDir,file.id+'.apk'));
          if(bytes.length!==file.size)return bad(res,'APK_STORAGE_CORRUPTED',500);
          res.writeHead(200,{'content-type':'application/vnd.android.package-archive',
            'content-length':bytes.length,'cache-control':'no-store','x-apk-sha256':file.sha256,
            'x-content-type-options':'nosniff'});
          return res.end(bytes);
        }
        if(req.method==='POST'&&route==='/lab-api/apk/agent/frame'){
          const pieces=[];let size=0;
          for await(const chunk of req){
            size+=chunk.length;
            if(size>3*1024*1024)return bad(res,'FRAME_TOO_LARGE',413);
            pieces.push(chunk);
          }
          const png=Buffer.concat(pieces);
          if(png.length<100||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
            return bad(res,'INVALID_PNG');
          const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
          if(width<1||height<1||width>8000||height>8000)return bad(res,'INVALID_FRAME_SIZE');
          const dest=path.join(framesDir,device+'.png');
          const tmp=dest+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
          await fs.writeFile(tmp,png,{mode:0o600});
          await fs.rename(tmp,dest);
          hosts.set(device,{deviceId:device,lastSeen:Date.now(),kind:identity.kind,width,height});
          return json(res,200,{ok:true,width,height,bytes:size});
        }
        if(req.method==='POST'&&route==='/lab-api/apk/agent/report'){
          const data=await readJson(req);
          const job=await readRecord(jobsDir,String(data.jobId));
          if(!job||job.deviceId!==device||job.status!=='installing'||
             job.leaseId!==data.leaseId)return bad(res,'JOB_LEASE_MISMATCH',409);
          job.status=data.success===true?(
            job.operation==='control'?'completed':job.operation==='store'?'opened':'installed'
          ):'failed';
          job.finishedAt=new Date().toISOString();
          job.packageName=String(data.packageName||'').slice(0,160);
          job.installLog=String(data.installLog||'').slice(-3000);
          job.error=data.success===true?null:String(data.error||'ADB_INSTALL_FAILED').slice(0,300);
          delete job.leaseId;
          await saveRecord(jobsDir,job);
          return json(res,200,{ok:true,jobId:job.id,status:job.status});
        }
        return bad(res,'UNKNOWN_AGENT_ENDPOINT',404);
      }
      if(!admin(req)&&!isTest)return unauthorized(res);
      if(req.method==='GET'&&route==='/lab-api/apk/files'){
        const records=await allRecords(filesDir);
        return json(res,200,{ok:true,files:isTest?records.filter(f=>f.testOnly===true):records});
      }
      if(req.method==='GET'&&route==='/lab-api/apk/jobs'){
        const jobs=await allRecords(jobsDir);
        return json(res,200,{ok:true,jobs:isTest?jobs.filter(j=>j.deviceId===TEST_DEVICE):jobs});
      }
      if(req.method==='GET'&&route.startsWith('/lab-api/apk/frame/')){
        const device=route.split('/').at(-1);
        if(!validDevice.test(device||'')||(isTest&&device!==TEST_DEVICE))return bad(res,'INVALID_DEVICE_ID');
        try{
          const png=await fs.readFile(path.join(framesDir,device+'.png'));
          res.writeHead(200,{'content-type':'image/png','content-length':png.length,
            'cache-control':'no-store','x-content-type-options':'nosniff'});
          return res.end(png);
        }catch{return bad(res,'NO_EMULATOR_FRAME',404)}
      }
      if(req.method==='POST'&&route==='/lab-api/apk/store'){
        const body=await readJson(req);
        const deviceId=String(body.deviceId||'');
        const packageName=String(body.packageName||'');
        const operation=body.operation==='verify'?'verify':'store';
        if((isTest&&deviceId!==TEST_DEVICE)||!validDevice.test(deviceId)||!(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i).test(packageName)||
           packageName.length>150)return bad(res,'INVALID_GOOGLE_PLAY_PACKAGE');
        const host=hosts.get(deviceId);
        if(!host||Date.now()-host.lastSeen>20_000)
          return bad(res,'EMULATOR_HOST_OFFLINE',409);
        // Both disposable GitHub Actions and persistent hosts may open Play Store.
        // The app is NOT considered installed until an independent pm-path verify job.
        if(operation==='store'&&!['persistent','ci'].includes(host.kind))
          return bad(res,'GOOGLE_PLAY_HOST_UNSUPPORTED',409);
        const job={id:crypto.randomUUID(),deviceId,operation,packageName,
          filename:(operation==='store'?'Play Store · ':'설치 확인 · ')+packageName,
          status:'pending',createdAt:new Date().toISOString(),error:null};
        await saveRecord(jobsDir,job);
        return json(res,201,{ok:true,job});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/control'){
        const body=await readJson(req);
        const device=String(body.deviceId||''),action=String(body.action||'');
        if((isTest&&device!==TEST_DEVICE)||!validDevice.test(device)||!['tap','back','home','scroll','playstore','type'].includes(action))
          return bad(res,'INVALID_CONTROL_ACTION');
        const host=hosts.get(device);
        if(!host||Date.now()-host.lastSeen>20_000)return bad(res,'EMULATOR_HOST_OFFLINE',409);
        const args={};
        if(action==='tap'){
          args.x=Number(body.x);args.y=Number(body.y);
          if(!Number.isInteger(args.x)||!Number.isInteger(args.y)||
            args.x<0||args.y<0||args.x>=host.width||args.y>=host.height)
            return bad(res,'INVALID_TOUCH_COORDINATE');
        }
        if(action==='scroll'){args.direction=body.direction==='up'?'up':'down';
          args.width=host.width;args.height=host.height;}
        // Search keywords only. Never transmit account passwords/credentials to
        // persisted ADB control jobs or retain credential typing in the queue.
        if(action==='type'){
          const term=String(body.text||'');
          if(term.length<1||term.length>70||!/^[A-Za-z0-9 ._-]+$/.test(term))
            return bad(res,'ONLY_NON_SENSITIVE_SEARCH_TEXT_ALLOWED');
          args.text=term;
        }
        const job={id:crypto.randomUUID(),deviceId:device,operation:'control',action,args,
          status:'pending',createdAt:new Date().toISOString(),error:null};
        await saveRecord(jobsDir,job);
        return json(res,201,{ok:true,job});
      }
      if(req.method==='GET'&&route==='/lab-api/apk/hosts'){
        return json(res,200,{ok:true,hosts:[...hosts.values()].filter(h=>!isTest||h.deviceId===TEST_DEVICE).map(h=>({
          deviceId:h.deviceId,kind:h.kind,lastSeen:new Date(h.lastSeen).toISOString(),
          width:h.width||null,height:h.height||null,online:Date.now()-h.lastSeen<20_000
        }))});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/upload'){
        const name=decodeURIComponent(String(req.headers['x-apk-filename']||'uploaded.apk'))
          .split(/[\\/]/).pop().slice(0,120);
        try{
          const file=await storeUpload(req,name);
          if(isTest){file.testOnly=true;await saveRecord(filesDir,file)}
          return json(res,201,{ok:true,file});
        }catch(e){return bad(res,e.message,e.message==='APK_TOO_LARGE'?413:400)}
      }
      if(req.method==='POST'&&route==='/lab-api/apk/jobs'){
        const data=await readJson(req);
        const apkId=String(data.apkId||''),deviceId=String(data.deviceId||'');
        if(!validId.test(apkId)||!validDevice.test(deviceId)||(isTest&&deviceId!==TEST_DEVICE))
          return bad(res,'INVALID_INSTALL_JOB');
        if(isTest){
          const apk=await readRecord(filesDir,apkId);
          if(!apk?.testOnly)return bad(res,'TEST_APK_REQUIRED',403);
        }
        const job=await queueInstall(apkId,deviceId,data.launchAfterInstall);
        return json(res,201,{ok:true,job});
      }
      return bad(res,'UNKNOWN_APK_ENDPOINT',404);
    }catch(e){
      console.error('APK_MANAGER_ERROR',String(e.message).slice(0,200));
      return bad(res,'APK_OPERATION_FAILED',500);
    }
  }
  return {http:handle};
}
