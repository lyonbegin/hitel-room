import {Sandbox} from 'railway';
import {readFileSync} from 'node:fs';
const ENABLED=Boolean(process.env.HITEL_RAILWAY_REDROID11_TEST_ONCE);
const CHECKPOINT='hitel-redroid11-kvmfree-ready';
const state={enabled:ENABLED,startedAt:null,endedAt:null,phase:'not-started',vmId:null,
  result:null,android11Booted:false,checkpoint:null,destroyed:false,notes:[]};
let started=false;
function log(phase,result=''){
 state.phase=phase;
 const x={at:new Date().toISOString(),phase,details:String(result).slice(0,9000)};
 state.notes.push(x);if(state.notes.length>30)state.notes.shift();
 console.log('HITEL_RAILWAY_REDROID11',JSON.stringify(x));
}
function format(r){return JSON.stringify({exitCode:r.exitCode,timedOut:r.timedOut,
stdout:String(r.stdout||'').slice(-5600),stderr:String(r.stderr||'').slice(-1200)})}
export function redroidStatus(){return {...state,notes:state.notes.slice(-15)}}
export function startRedroidTest(){
 if(!ENABLED||started)return;
 started=true;
 state.startedAt=new Date().toISOString();
 void(async()=>{
  let vm=null;
  try{
   const all=await Sandbox.list();
   if(all.some(s=>['CREATING','RUNNING','DESTROYING'].includes(s.status))){
    state.result='skipped-another-vm-active';
    log('existing-sandbox-prevents-new-cost');
    return;
   }
   log('real-railway-vm-creating');
   vm=await Sandbox.create({resources:{cpu:4,memoryGB:6},idleTimeoutMinutes:2,networkIsolation:'ISOLATED'});
   state.vmId=vm.id;
   log('real-railway-vm-created',vm.id);
   await vm.files.write('/opt/hitel/redroid-test.sh',
     readFileSync(new URL('./redroid11-kvmfree-test.sh',import.meta.url),'utf8'),{mode:0o755});
   log('redroid11-boot-attempt-start');
   const result=await vm.exec('bash /opt/hitel/redroid-test.sh',{timeoutSec:460});
   log('redroid11-boot-result',format(result));
   state.result=result.exitCode===0?'real-android11-kvmfree-booted':'real-android11-kvmfree-failed';
   state.android11Booted=result.exitCode===0;
   if(result.exitCode===0){
    log('redroid-checkpoint-saving',CHECKPOINT);
    await vm.checkpoint(CHECKPOINT);
    state.checkpoint=CHECKPOINT;
    log('redroid-checkpoint-ready',CHECKPOINT);
   }
  }catch(err){
   state.result='error';
   log('redroid-railway-error',String(err?.message||err));
  }finally{
   if(vm){
    try{await vm.destroy();state.destroyed=true;log('redroid-vm-destroyed',vm.id)}
    catch(err){log('redroid-vm-destroy-error',String(err))}
   }
   state.endedAt=new Date().toISOString();
   log('final',JSON.stringify({result:state.result,booted:state.android11Booted,
     checkpoint:state.checkpoint,destroyed:state.destroyed}));
  }
 })();
}
