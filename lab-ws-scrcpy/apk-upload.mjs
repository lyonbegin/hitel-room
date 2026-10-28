// Disposable Android APK upload and launch. Called by the ws-scrcpy HTTPS gateway.
import {createWriteStream} from 'node:fs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
const exec=promisify(execFile);
const ORIGIN='https://hitel-communication-web-production.up.railway.app';
const MAX_APK=60*1024*1024;
let uploading=false;
const cors={'access-control-allow-origin':ORIGIN,'vary':'Origin',
 'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type',
 'cache-control':'no-store','content-type':'application/json; charset=utf-8'};
function reply(res,status,payload){res.writeHead(status,cors);res.end(JSON.stringify(payload))}
export async function handleApk(req,res){
 if(req.url?.split('?')[0]!=='/__hitel_apk_install')return false;
 if(req.headers.origin!==ORIGIN){reply(res,403,{ok:false,error:'SITE_ORIGIN_REQUIRED'});return true}
 if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return true}
 if(req.method!=='POST'){reply(res,405,{ok:false,error:'POST_REQUIRED'});return true}
 if(uploading){reply(res,409,{ok:false,error:'INSTALL_ALREADY_RUNNING'});return true}
 const length=req.headers['content-length']===undefined?null:Number(req.headers['content-length']);
 if(length!==null&&(!Number.isInteger(length)||length<512||length>MAX_APK)){
  reply(res,413,{ok:false,error:'APK_SIZE_INVALID_MAX_60MB'});return true;
 }
 if(!['application/vnd.android.package-archive','application/octet-stream'].includes(String(req.headers['content-type']||'').split(';')[0])){
  reply(res,415,{ok:false,error:'APK_MEDIA_TYPE_REQUIRED'});return true;
 }
 uploading=true;let folder='';
 try{
  folder=await mkdtemp(join(tmpdir(),'hitel-apk-'));
  const file=join(folder,'upload.apk');
  let uploaded=0;
  const limiter=new Transform({transform(chunk,encoding,callback){uploaded+=chunk.length;
   callback(uploaded>MAX_APK?Error('APK_EXCEEDS_60MB'):null,chunk);}});
  await pipeline(req,limiter,createWriteStream(file));
  if(uploaded<512)throw Error('APK_TOO_SMALL');
  const magic=await readFile(file);
  if(magic[0]!==80||magic[1]!==75)throw Error('INVALID_APK_ZIP_SIGNATURE');
  const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'/usr/local/lib/android/sdk';
  const build=await exec('bash',['-lc',`find "${sdk}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1`],{timeout:15000});
  const aapt=join(build.stdout.trim(),'aapt');
  const badging=await exec(aapt,['dump','badging',file],{timeout:15000});
  const pkg=badging.stdout.match(/package: name='([a-zA-Z0-9_.]+)'/)?.[1];
  if(!pkg)throw Error('APK_PACKAGE_NAME_MISSING');
  const install=await exec('adb',['install','-r',file],{timeout:90000});
  if(!install.stdout.includes('Success'))throw Error('ADB_INSTALL_DID_NOT_CONFIRM_SUCCESS');
  const launched=await exec('adb',['shell','monkey','-p',pkg,'-c','android.intent.category.LAUNCHER','1'],{timeout:20000});
  if(!launched.stdout.includes('Events injected: 1'))throw Error('APK_NO_LAUNCHER_ACTIVITY');
  console.log('HITEL_APK_INSTALLED_AND_LAUNCHED',pkg);
  reply(res,200,{ok:true,installed:true,launched:true,packageName:pkg});
 }catch(err){console.error('HITEL_APK_INSTALL_FAILED',String(err));reply(res,500,{ok:false,error:String(err.message||err).slice(0,240)})}
 finally{uploading=false;if(folder)await rm(folder,{recursive:true,force:true}).catch(()=>{})}
 return true;
}
