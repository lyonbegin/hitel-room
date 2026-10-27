// Railway only: disposable real-VM Android 11 TCG validation.
// Trigger: HITEL_RAILWAY_TCG_PROBE_ONCE=run-<nonce> on one Railway deployment.
// No GitHub Actions, no always-on emulator, no permanent relay.
import {Sandbox} from 'railway';
import {readFileSync} from 'node:fs';
const armed=String(process.env.HITEL_RAILWAY_TCG_PROBE_ONCE||'');
let started=false;
const startTime=()=>new Date().toISOString();
const state={armed:Boolean(armed),vmId:null,startedAt:null,endedAt:null,phase:'not-started',result:null,exitCode:null,notes:[]};
function record(phase,details=''){
 state.phase=phase;
 const note={at:startTime(),phase,details:String(details).slice(0,1800)};
 state.notes.push(note);
 if(state.notes.length>30)state.notes.shift();
 console.log('HITEL_RAILWAY_TCG_PROBE',JSON.stringify(note));
}
function describe(r){
 return JSON.stringify({exitCode:r.exitCode,timedOut:r.timedOut,stdout:String(r.stdout||'').slice(-1500),stderr:String(r.stderr||'').slice(-1500)});
}
export function getTcgProbeStatus(){return {...state,notes:state.notes.slice(-15)};}
export function launchTcgProbeWhenArmed(){
 if(started||!armed)return;
 started=true;
 void (async()=>{
  let sb=null;
  state.startedAt=startTime();
  try{
   const current=await Sandbox.list();
   const used=current.filter(s=>['CREATING','RUNNING','DESTROYING'].includes(s.status));
   if(used.length){state.result='skipped-sandbox-already-active';record('blocked-active-sandbox',used.length);return;}
   record('railway-sandbox-creating');
   try{
    sb=await Sandbox.create({networkIsolation:'ISOLATED',idleTimeoutMinutes:2,resources:{cpu:4,memoryGB:6}});
   }catch(sizeError){
    record('sandbox-size-fallback',String(sizeError?.message||sizeError).slice(0,200));
    sb=await Sandbox.create({networkIsolation:'ISOLATED',idleTimeoutMinutes:2,resources:{cpu:2,memoryGB:4}});
   }
   state.vmId=sb.id;
   record('railway-sandbox-real-created',sb.id);
   const host=await sb.exec('sh -lc "uname -m; if test -c /dev/kvm; then echo KVM_AVAILABLE; else echo KVM_UNAVAILABLE; fi; free -h | head -n 2"',{timeoutSec:20});
   record('hardware-check',describe(host));
   await sb.files.write('/opt/hitel/install.sh',readFileSync(new URL('./tcg-install.sh',import.meta.url),'utf8'),{mode:0o755});
   await sb.files.write('/opt/hitel/boot.sh',readFileSync(new URL('./tcg-boot.sh',import.meta.url),'utf8'),{mode:0o755});
   record('android11-installing');
   const installed=await sb.exec('bash /opt/hitel/install.sh',{timeoutSec:410});
   record('android11-install-result',describe(installed));
   if(installed.exitCode!==0){
    state.result=installed.timedOut?'installation-timeout':'installation-failed';
    state.exitCode=installed.exitCode;
    return;
   }
   record('android11-booting-without-kvm');
   const booted=await sb.exec('bash /opt/hitel/boot.sh',{timeoutSec:190});
   record('android11-boot-result',describe(booted));
   state.exitCode=booted.exitCode;
   state.result=booted.exitCode===0?'android11-booted':'android11-not-booted';
  }catch(error){state.result='error';record('probe-exception',String(error?.message||error));}
  finally{
   if(sb){
    record('railway-sandbox-destroying',sb.id);
    try{await sb.destroy();record('railway-sandbox-destroyed',sb.id)}
    catch(error){record('railway-sandbox-destroy-error',String(error))}
   }
   state.endedAt=startTime();
   record('final',JSON.stringify({result:state.result,exitCode:state.exitCode,vmId:state.vmId}));
  }
 })();
}
