import {Sandbox} from 'railway';
import {readFileSync} from 'node:fs';
const REQUEST=String(process.env.HITEL_RAILWAY_CHECKPOINT_TEST_ONCE||'');
const CHECKPOINT='hitel-android11-tcg-installed';
const state={armed:Boolean(REQUEST),phase:'idle',checkpoint:CHECKPOINT,installSandbox:null,bootSandbox:null,bootCompleted:false,
  startedAt:null,endedAt:null,notes:[],result:null,cleanup:{install:false,boot:false}};
let running=false;
const stamp=()=>new Date().toISOString();
function report(phase,data=''){
 state.phase=phase;
 const evt={time:stamp(),phase,detail:String(data).slice(0,2200)};
 state.notes.push(evt);if(state.notes.length>35)state.notes.shift();
 console.log('HITEL_CHECKPOINT_ANDROID11_TEST',JSON.stringify(evt));
}
const short=r=>JSON.stringify({exitCode:r.exitCode,timedOut:r.timedOut,
  stdout:String(r.stdout||'').slice(-1800),stderr:String(r.stderr||'').slice(-1200)});
const options={resources:{cpu:4,memoryGB:6},networkIsolation:'ISOLATED',idleTimeoutMinutes:2};
async function dispose(vm,part){
 if(!vm){state.cleanup[part]=true;return;}
 try{await vm.destroy();state.cleanup[part]=true;report('sandbox-destroyed',part+':'+vm.id);}
 catch(e){report('sandbox-destroy-error',part+':'+String(e).slice(0,400));}
}
async function create(from){
 try{return await Sandbox.create(...(from?[from,options]:[options]));}
 catch(e){
  if(from)throw e;
  report('size-fallback',String(e).slice(0,200));
  return await Sandbox.create({...options,resources:{cpu:2,memoryGB:4}});
 }
}
export function checkpointTestStatus(){return {...state,notes:state.notes.slice(-25)};}
export function startCheckpointTestOnce(){
 if(!REQUEST||running)return;
 running=true;state.startedAt=stamp();
 void(async()=>{
  let setup=null,boot=null;
  try{
   const live=(await Sandbox.list()).filter(x=>['CREATING','RUNNING','DESTROYING'].includes(x.status));
   if(live.length){state.result='blocked-existing-vm';report('refused-existing-vm',live.length);return;}
   let present=(await Sandbox.checkpoints()).some(x=>x.key===CHECKPOINT);
   report('checkpoint-exists',String(present));
   if(!present){
    report('prepare-vm-creating');
    setup=await create();
    state.installSandbox=setup.id;
    report('prepare-vm-created',setup.id);
    await setup.files.write('/opt/hitel/install.sh',readFileSync(new URL('./tcg-install.sh',import.meta.url),'utf8'),{mode:0o755});
    await setup.files.write('/opt/hitel/boot.sh',readFileSync(new URL('./tcg-boot.sh',import.meta.url),'utf8'),{mode:0o755});
    report('android-sdk-installing');
    const installation=await setup.exec('bash /opt/hitel/install.sh',{timeoutSec:420});
    report('android-sdk-installed',short(installation));
    if(installation.exitCode!==0){state.result='installation-failed';return;}
    report('checkpoint-saving');
    await setup.checkpoint(CHECKPOINT);
    report('checkpoint-saved',CHECKPOINT);
    present=true;
    await dispose(setup,'install');setup=null;
   }
   if(!present){state.result='checkpoint-missing';return;}
   report('boot-vm-creating-from-checkpoint');
   boot=await create(CHECKPOINT);
   state.bootSandbox=boot.id;
   report('boot-vm-created',boot.id);
   // Make the first boot without any installation/setup delay.
   report('android11-software-boot-started');
   // Cold boot needs more than the 160-second one-off probe, and never claims success without sys.boot_completed=1.
   const patched=await boot.exec("python3 -c 'from pathlib import Path; p=Path(\"/opt/hitel/boot.sh\"); t=p.read_text(); t=t.replace(\"seq 1 160\",\"seq 1 500\"); p.write_text(t)'",{timeoutSec:15});
   report('long-boot-window',short(patched));
   const result=await boot.exec('bash /opt/hitel/boot.sh',{timeoutSec:580});
   report('android11-software-boot-ended',short(result));
   if(result.exitCode===0){
    state.bootCompleted=true;state.result='android11-tcg-boot-success';
   }else{state.result='android11-tcg-boot-failed-or-timeout';}
   // Android's process log is essential when emulator boot never completes.
   try{
    const log=await boot.exec('bash -c "tail -n 65 /tmp/hitel-tcg-emulator.log 2>/dev/null || true"',{timeoutSec:15});
    report('emulator-log-tail',short(log));
   }catch(e){report('emulator-log-error',String(e).slice(0,250))}
  }catch(e){state.result='error';report('test-error',String(e).slice(0,500));}
  finally{
   await dispose(boot,'boot');await dispose(setup,'install');
   state.endedAt=stamp();
   report('final',JSON.stringify({result:state.result,bootCompleted:state.bootCompleted,
     checkpoint:CHECKPOINT,deleted:state.cleanup}));
  }
 })();
}
