import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Independent compatibility adapter for the untouched MIT-licensed Android
 * Emulator Platform React dashboard. The original 53 source files are never
 * changed. Calls enqueue jobs for the EXISTING HITEL Google Play ADB runner.
 *
 * This is an adapter, NOT the upstream scrcpy/noVNC streaming implementation:
 * /stream/ci-playstore/phone.html polls native PNG frames produced by ADB.
 */
export function createAndroidOriginalAdapter({root,maxUploadBytes=80*1024*1024}={}) {
  if(!root)throw Error('ANDROID_ORIGINAL_STORAGE_REQUIRED');
  const runFile=path.join(root,'interactive-request.json');
  const filesDir=path.join(root,'files');
  const jobsDir=path.join(root,'jobs');
  const framesDir=path.join(root,'frames');
  const deviceId='ci-playstore';
  const starterWindows=new Map();
  const OWNER='hitel_ui_owner';
  const VISITOR='hitel_android_original_guest';
  const HOST_ORIGIN='https://hitel-communication-web-production.up.railway.app';
  const idPattern=/^[a-f0-9-]{36}$/i;
  let locking=Promise.resolve();
  const serial=(fn)=>{const job=locking.then(fn,fn);locking=job.catch(()=>{});return job};
  const json=(res,status,obj)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(obj));
  };
  const fail=(res,status,error)=>json(res,status,{error});
  const read=async()=>{try{return JSON.parse(await fs.readFile(runFile,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
  const write=async(s)=>{await fs.mkdir(root,{recursive:true,mode:0o700});
    const temp=runFile+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
    await fs.writeFile(temp,JSON.stringify(s),{mode:0o600});await fs.rename(temp,runFile)};
  const cookie=(req)=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(OWNER+'='))?.slice(OWNER.length+1)||'';
  const visitor=(req)=>String(req.headers.cookie||'').split(';').map(s=>s.trim())
    .find(s=>s.startsWith(VISITOR+'='))?.slice(VISITOR.length+1)||'';
  const owns=(req,s)=>Boolean(s&&s.owner&&cookie(req)===s.owner);
  const fresh=(s)=>!!s&&Date.now()-Date.parse(s.createdAt)<18*60_000;
  const active=(s)=>fresh(s)&&['queued','starting','running','stopping'].includes(s.status);
  const ipOf=(req)=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
  const checkOrigin=(req)=>req.headers.origin===HOST_ORIGIN||req.headers.origin==='http://127.0.0.1';
  async function bodyJson(req){
    let count=0,parts=[];
    for await(const buf of req){count+=buf.length;if(count>8192)throw Error('BODY_TOO_LARGE');parts.push(buf)}
    return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');
  }
  async function all(dir){
    try{
      const names=(await fs.readdir(dir)).filter(s=>idPattern.test(s.slice(0,-5))&&s.endsWith('.json'));
      const records=await Promise.all(names.map(async n=>JSON.parse(await fs.readFile(path.join(dir,n),'utf8'))));
      return records.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    }catch(e){if(e.code==='ENOENT')return [];throw e}
  }
  async function saveJob(j){
    await fs.mkdir(jobsDir,{recursive:true,mode:0o700});
    const file=path.join(jobsDir,j.id+'.json');
    const temp=file+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';
    await fs.writeFile(temp,JSON.stringify(j),{mode:0o600});await fs.rename(temp,file);
  }
  async function hostFrame(s){
    if(!s||!['running','starting','stopping'].includes(s.status))return null;
    try{
      const filename=path.join(framesDir,deviceId+'.png');
      const info=await fs.stat(filename);
      if(info.mtimeMs<Date.parse(s.createdAt)||Date.now()-info.mtimeMs>20_000)return null;
      const bytes=await fs.readFile(filename);
      if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return null;
      return {bytes,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
    }catch{return null}
  }
  const summary=(s)=>({sessionId:s.id,slotId:deviceId,device:'Pixel 6 · Android 15 · Google Play',
    containerName:'hitel-disposable-android',status:s.status,createdAt:s.createdAt,
    timeoutMinutes:13,vncUrl:'/stream/ci-playstore/'});
  async function uploadApk(req,res){
    const ct=String(req.headers['content-type']||'');
    const boundary=ct.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[1]||
      ct.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[2];
    if(!/^multipart\/form-data/i.test(ct)||!boundary||boundary.length>200)return fail(res,400,'MULTIPART_APK_REQUIRED');
    let count=0,parts=[];
    for await(const chunk of req){
      count+=chunk.length;
      if(count>maxUploadBytes+8192)return fail(res,413,'APK_TOO_LARGE');
      parts.push(chunk);
    }
    const buf=Buffer.concat(parts);
    const marker=Buffer.from('name="apk"');
    const idx=buf.indexOf(marker);
    if(idx<0)return fail(res,400,'APK_FIELD_REQUIRED');
    const headerEnd=buf.indexOf(Buffer.from('\r\n\r\n'),idx);
    const next=buf.indexOf(Buffer.from('\r\n--'+boundary),headerEnd+4);
    if(headerEnd<0||next<0)return fail(res,400,'INVALID_APK_FORM');
    const header=buf.subarray(Math.max(0,buf.lastIndexOf(Buffer.from('--'+boundary),idx)),headerEnd).toString('utf8');
    const filename=path.basename(header.match(/filename="([^"]+)"/i)?.[1]||'upload.apk').slice(0,120);
    if(!filename.toLowerCase().endsWith('.apk'))return fail(res,400,'APK_EXTENSION_REQUIRED');
    const payload=buf.subarray(headerEnd+4,next);
    if(payload.length<100||payload.length>maxUploadBytes||payload.subarray(0,4).toString('hex')!=='504b0304')
      return fail(res,400,'APK_ZIP_HEADER_INVALID');
    const id=crypto.randomUUID();
    const entry={id,filename,size:payload.length,sha256:crypto.createHash('sha256').update(payload).digest('hex'),
      createdAt:new Date().toISOString(),format:'apk',testOnly:true,
      originalOwner:visitor(req)};
    await fs.mkdir(filesDir,{recursive:true,mode:0o700});
    await fs.writeFile(path.join(filesDir,id+'.apk'),payload,{mode:0o600,flag:'wx'});
    await fs.writeFile(path.join(filesDir,id+'.json'),JSON.stringify(entry),{mode:0o600,flag:'wx'});
    return json(res,201,{apkId:id,filename,size:payload.length});
  }
  async function handler(req,res,url){
    const route=url.pathname;
    const method=req.method||'GET';
    try{
      if(method==='GET'&&route==='/api/emulator/devices'){
        const s=await read();
        if(!visitor(req))res.setHeader('set-cookie',VISITOR+'='+crypto.randomBytes(24).toString('base64url')+
          '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7200');
        return json(res,200,{devices:[{device:'Pixel 6 · Android 15 · Google Play',total:1,free:active(s)?0:1}]});
      }
      if(method==='GET'&&route==='/api/emulator/sessions'){
        const s=await read();const sessions=active(s)&&owns(req,s)?[summary(s)]:[];
        return json(res,200,{sessions,count:sessions.length,maxConcurrent:1,
          free:active(s)?0:1});
      }
      if(method==='GET'&&route==='/api/upload/apks'){
        const identity=visitor(req);
        const entries=identity?(await all(filesDir)).filter(f=>f.testOnly&&f.originalOwner===identity):[];
        return json(res,200,{apks:entries.map(f=>({
          id:f.id,original_name:f.filename,file_size:f.size,uploaded_at:f.createdAt
        }))});
      }
      if(method==='POST'&&route==='/api/emulator/session'){
        if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
        const b=await bodyJson(req);
        if(b.device!=='Pixel 6 · Android 15 · Google Play')return fail(res,400,'UNKNOWN_DEVICE');
        return await serial(async()=>{
          const prev=await read();
          if(active(prev))return fail(res,409,'ANDROID_SESSION_ALREADY_ACTIVE');
          const ip=ipOf(req),w=starterWindows.get(ip)||{since:Date.now(),count:0};
          if(Date.now()-w.since>3600_000){w.since=Date.now();w.count=0}
          if(w.count>=3)return fail(res,429,'ANDROID_START_RATE_LIMIT');
          ++w.count;starterWindows.set(ip,w);
          const s={id:crypto.randomUUID(),owner:crypto.randomBytes(24).toString('base64url'),
            status:'queued',createdAt:new Date().toISOString(),endedAt:null};
          await write(s);
          res.setHeader('set-cookie',OWNER+'='+s.owner+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7200');
          return json(res,201,{...summary(s),message:'Android queued; host not connected yet',connected:false});
        });
      }
      const isSessionEndpoint=route.startsWith('/api/emulator/session/');
      const sessionId=isSessionEndpoint?route.slice('/api/emulator/session/'.length):null;
      if(isSessionEndpoint){
        const s=await read();if(!owns(req,s)||s.id!==sessionId)
          return fail(res,404,'SESSION_NOT_FOUND');
        if(method==='GET'){const frame=await hostFrame(s);
          return json(res,200,{...summary(s),connected:!!frame,status:frame?'running':s.status})}
        if(method==='DELETE'){
          if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
          if(['queued','starting','running'].includes(s.status)){
            s.status=s.status==='queued'?'completed':'stopping';s.stopAt=new Date().toISOString();
            if(s.status==='completed')s.endedAt=s.stopAt;await write(s);
          }
          return json(res,200,{message:'Session stop requested',sessionId});
        }
      }
      if(route.startsWith('/api/emulator/frame/')&&method==='GET'){
        const id=route.slice('/api/emulator/frame/'.length);
        const s=await read();
        if(!owns(req,s)||id!==s.id)return fail(res,403,'SESSION_NOT_OWNED');
        const f=await hostFrame(s);if(!f)return fail(res,404,'ANDROID_FRAME_NOT_AVAILABLE');
        res.writeHead(200,{'content-type':'image/png','cache-control':'no-store',
          'content-length':f.bytes.length});return res.end(f.bytes);
      }
      if(route.startsWith('/api/emulator/screenshot/')&&method==='POST'){
        const id=route.slice('/api/emulator/screenshot/'.length);
        const s=await read();
        if(!owns(req,s)||id!==s.id)return fail(res,403,'SESSION_NOT_OWNED');
        const f=await hostFrame(s);if(!f)return fail(res,409,'ANDROID_FRAME_NOT_AVAILABLE');
        res.writeHead(200,{'content-type':'image/png','cache-control':'no-store',
          'content-length':f.bytes.length});return res.end(f.bytes);
      }
      if(method==='POST'&&(route.startsWith('/api/emulator/key/')||route.startsWith('/api/emulator/tap/'))){
        if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
        const id=route.split('/').at(-1),s=await read();
        if(!owns(req,s)||s.id!==id)return fail(res,403,'SESSION_NOT_OWNED');
        const f=await hostFrame(s);if(!f)return fail(res,409,'ANDROID_HOST_OFFLINE');
        const b=await bodyJson(req);
        let action,args={};
        if(route.includes('/key/')){
          action={HOME:'home',BACK:'back'}[b.key];
          if(!action)return fail(res,501,'ANDROID_KEY_NOT_SUPPORTED_BY_RUNNER');
        }else{
          action='tap';
          const xFrac=Number(b.xFrac),yFrac=Number(b.yFrac);
          if(!Number.isFinite(xFrac)||!Number.isFinite(yFrac)||xFrac<0||yFrac<0||xFrac>1||yFrac>1)
            return fail(res,400,'INVALID_TAP_COORDINATE');
          args={x:Math.min(f.width-1,Math.floor(xFrac*f.width)),y:Math.min(f.height-1,Math.floor(yFrac*f.height))};
        }
        const j={id:crypto.randomUUID(),deviceId,operation:'control',action,args,status:'pending',
          createdAt:new Date().toISOString(),error:null};
        await saveJob(j);
        return json(res,202,{ok:true,queued:true,jobId:j.id});
      }
      if(method==='POST'&&route==='/api/upload/apk'){
        if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
        const identity=visitor(req);if(!identity)return fail(res,403,'VISITOR_SESSION_REQUIRED');
        const uploads=(await all(filesDir)).filter(f=>f.originalOwner===identity);
        if(uploads.length>=5)return fail(res,429,'APK_UPLOAD_LIMIT_REACHED');
        return await uploadApk(req,res);
      }
      if(method==='POST'&&route==='/api/upload/install'){
        if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
        const s=await read();if(!owns(req,s))return fail(res,403,'SESSION_NOT_OWNED');
        const b=await bodyJson(req);
        if(b.sessionId!==s.id||!idPattern.test(String(b.apkId)))return fail(res,400,'INVALID_INSTALL_REQUEST');
        const f=await hostFrame(s);if(!f)return fail(res,409,'ANDROID_HOST_OFFLINE');
        const identity=visitor(req);
        const entry=(await all(filesDir)).find(f=>f.id===b.apkId&&f.testOnly&&f.originalOwner===identity);
        if(!entry)return fail(res,404,'UNKNOWN_APK');
        const j={id:crypto.randomUUID(),apkId:entry.id,deviceId,filename:entry.filename,
          launchAfterInstall:true,status:'pending',createdAt:new Date().toISOString(),error:null};
        await saveJob(j);
        // The original UI expects the synchronous upstream ADB install result.
        // Wait for signed emulator worker to report actual status; never claim success on enqueue.
        const deadline=Date.now()+150_000;
        while(Date.now()<deadline){
          await new Promise(done=>setTimeout(done,1800));
          const record=JSON.parse(await fs.readFile(path.join(jobsDir,j.id+'.json'),'utf8'));
          if(record.status==='installed')
            return json(res,200,{success:true,apkId:entry.id,sessionId:s.id,
              package:record.packageName||null,launched:!!record.packageName,output:record.installLog||''});
          if(record.status==='failed')
            return json(res,200,{success:false,apkId:entry.id,sessionId:s.id,
              output:record.error||'ADB_INSTALL_FAILED'});
        }
        return json(res,202,{success:false,apkId:entry.id,sessionId:s.id,
          output:'INSTALLATION_PENDING_ON_ANDROID_HOST'});
      }
      if(method==='DELETE'&&route.startsWith('/api/upload/apk/')){
        if(!checkOrigin(req))return fail(res,403,'WEB_ORIGIN_REQUIRED');
        const identity=visitor(req),id=route.slice('/api/upload/apk/'.length);
        const entry=(await all(filesDir)).find(f=>f.id===id&&f.originalOwner===identity);
        if(!entry)return fail(res,404,'APK_NOT_FOUND');
        await fs.rm(path.join(filesDir,id+'.apk'),{force:true});
        await fs.rm(path.join(filesDir,id+'.json'),{force:true});
        return json(res,200,{deleted:id});
      }
      return fail(res,501,'ORIGINAL_FEATURE_NOT_YET_BRIDGED_TO_ANDROID_RUNNER');
    }catch(e){
      console.error('ANDROID_ORIGINAL_ADAPTER',route,String(e.message||e).slice(0,140));
      return fail(res,500,'ANDROID_ORIGINAL_ADAPTER_ERROR');
    }
  }
  return {http:handler};
}
