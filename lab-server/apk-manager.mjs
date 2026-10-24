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
  const hosts=new Map();
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
    if(device==='ci-android'){
      const identity=await verifyCI(req);
      return {kind:'ci',device,runId:String(identity.run_id||'')};
    }
    throw Error('AUTHORIZED_EMULATOR_AGENT_REQUIRED');
  }
  const ready=Promise.all([fs.mkdir(filesDir,{recursive:true,mode:0o700}),
    fs.mkdir(jobsDir,{recursive:true,mode:0o700})]);
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
  async function handle(req,res,url){
    const route=url.pathname;
    await ready;
    try{
      if(req.method==='GET'&&route==='/lab-api/apk/health')
        return json(res,200,{ok:true,enabled:!!adminToken,mode:'APK queue + external emulator agent'});
      if(route.startsWith('/lab-api/apk/agent/')){
        const device=String(req.headers['x-emulator-device']||'');
        let identity;
        try{identity=await agent(req,device)}
        catch{return unauthorized(res)}
        hosts.set(device,{deviceId:device,lastSeen:Date.now(),kind:identity.kind});
        if(req.method==='POST'&&route==='/lab-api/apk/agent/next'){
          // Choose oldest pending job. A lease prevents concurrent installers.
          const jobs=(await allRecords(jobsDir)).reverse();
          let job=jobs.find(j=>j.deviceId===device&&j.status==='pending');
          if(!job)job=jobs.find(j=>j.deviceId===device&&j.status==='installing'&&
            Date.now()-(Date.parse(j.startedAt)||0)>15*60_000);
          if(!job)return json(res,200,{ok:true,job:null});
          const file=await readRecord(filesDir,job.apkId);
          if(!file){job.status='failed';job.error='APK_NOT_FOUND';await saveRecord(jobsDir,job);return bad(res,'APK_NOT_FOUND',410)}
          job.status='installing';job.startedAt=new Date().toISOString();job.leaseId=crypto.randomUUID();
          job.agentKind=identity.kind;await saveRecord(jobsDir,job);
          return json(res,200,{ok:true,job:{id:job.id,apkId:file.id,sha256:file.sha256,
            size:file.size,filename:file.filename,leaseId:job.leaseId}});
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
        if(req.method==='POST'&&route==='/lab-api/apk/agent/report'){
          const data=await readJson(req);
          const job=await readRecord(jobsDir,String(data.jobId));
          if(!job||job.deviceId!==device||job.status!=='installing'||
             job.leaseId!==data.leaseId)return bad(res,'JOB_LEASE_MISMATCH',409);
          job.status=data.success===true?'installed':'failed';
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
      if(!admin(req))return unauthorized(res);
      if(req.method==='GET'&&route==='/lab-api/apk/files'){
        const records=await allRecords(filesDir);
        return json(res,200,{ok:true,files:records});
      }
      if(req.method==='GET'&&route==='/lab-api/apk/jobs'){
        const jobs=await allRecords(jobsDir);
        return json(res,200,{ok:true,jobs});
      }
      if(req.method==='GET'&&route==='/lab-api/apk/hosts'){
        return json(res,200,{ok:true,hosts:[...hosts.values()].map(h=>({
          deviceId:h.deviceId,kind:h.kind,lastSeen:new Date(h.lastSeen).toISOString(),
          online:Date.now()-h.lastSeen<60_000
        }))});
      }
      if(req.method==='POST'&&route==='/lab-api/apk/upload'){
        const name=decodeURIComponent(String(req.headers['x-apk-filename']||'uploaded.apk')).split(/[\\/]/).pop().slice(0,120);
        if(!name.toLowerCase().endsWith('.apk')||!name.length)return bad(res,'APK_FILENAME_REQUIRED');
        const declared=Number(req.headers['content-length']||0);
        if(declared>maxBytes)return bad(res,'APK_TOO_LARGE',413);
        const id=crypto.randomUUID();
        const dest=path.join(filesDir,id+'.apk');
        const hash=crypto.createHash('sha256');
        let count=0,first=Buffer.alloc(0);
        try{
          const output=createWriteStream(dest,{flags:'wx',mode:0o600});
          await pipeline(req,async function* (source){
            for await(const chunk of source){
              count+=chunk.length;
              if(count>maxBytes)throw Error('APK_TOO_LARGE');
              if(first.length<4)first=Buffer.concat([first,chunk]).subarray(0,4);
              hash.update(chunk);yield chunk;
            }
          },output);
          if(count<100||first.toString('hex')!=='504b0304')throw Error('INVALID_APK_ZIP_HEADER');
          const record={id,filename:name,size:count,sha256:hash.digest('hex'),
            createdAt:new Date().toISOString(),format:'apk'};
          await saveRecord(filesDir,record);
          return json(res,201,{ok:true,file:record});
        }catch(e){
          await fs.rm(dest,{force:true});
          return bad(res,e.message,e.message==='APK_TOO_LARGE'?413:400);
        }
      }
      if(req.method==='POST'&&route==='/lab-api/apk/jobs'){
        const data=await readJson(req);
        const apkId=String(data.apkId||''),deviceId=String(data.deviceId||'');
        if(!validId.test(apkId)||!validDevice.test(deviceId))return bad(res,'INVALID_INSTALL_JOB');
        const file=await readRecord(filesDir,apkId);
        if(!file)return bad(res,'UNKNOWN_APK',404);
        const job={id:crypto.randomUUID(),apkId,filename:file.filename,deviceId,
          status:'pending',createdAt:new Date().toISOString(),error:null};
        await saveRecord(jobsDir,job);
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
