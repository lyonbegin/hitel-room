import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Built SDK is validated without a browser or an external Fly account.
globalThis.window = new EventTarget();
const { CommunicationSDK, HitelPublicRooms, createHitelPublicRooms } =
  await import(pathToFileURL(resolve('dist/sdk/communication.esm.js')).href);

const open = {
  id:'public-room-1', type:'PUBLIC_ROOM', title:'Anyone may enter', status:'LIVE',
  hostUserIds:['host-1'],participants:[],
  policy:{topology:'MANY_TO_MANY',maxParticipants:8,waitingRoom:false,
    requireHostStart:false,allowUnlistedParticipants:true,allowRejoinAfterEnd:false},
};

function socketFor(room=open){
  const events=[];
  const socket={
    connected:true,
    timeout(){return this},
    emit(name,payload,cb){
      events.push({name,payload});
      if(name==='session:join') cb(null,{ok:true,data:{session:room}});
      else cb(null,{ok:true,data:{}});
    }
  };
  return {socket,events};
}

test('public room catalog is fetched from the original authenticated Fly API',async()=>{
  const calls=[];
  const previous=globalThis.fetch;
  globalThis.fetch=async (url,init)=>{
    calls.push({url,init});
    if(init.method==='POST')return Response.json(open,{status:201});
    return Response.json([open]);
  };
  try {
    const {socket}=socketFor();
    const client=createHitelPublicRooms({socket,accessToken:'test-token'});
    assert.equal((await client.list())[0].id,open.id);
    assert.equal(calls[0].url,'/api/public-rooms');
    assert.equal(new Headers(calls[0].init.headers).get('Authorization'),'Bearer test-token');
    const created=await client.create({title:'Shared room',maxParticipants:4});
    assert.equal(created.id,open.id);
    const request=JSON.parse(calls[1].init.body);
    assert.deepEqual(request,{title:'Shared room',maxParticipants:4});
    assert.equal('participants' in request,false,'No invitation list or callee ID is requested');
  }finally{globalThis.fetch=previous}
});

test('authenticated new guest automatically joins a LIVE room, then SDK starts real RTC adapter',async()=>{
  const {socket,events}=socketFor();
  const client=new HitelPublicRooms({socket,accessToken:'guest-token'});
  const adapterCalls=[];
  const adapter={join:async opts=>{
    adapterCalls.push(opts);
    return {isStarted:()=>true,leave:async()=>{adapterCalls.push('left')}};
  }};
  const sdk=CommunicationSDK.create({
    publicRooms:client,roomAdapter:adapter,
    nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}
  });
  let connected=false;sdk.on(event=>{if(event.type==='rtc.connected')connected=true});
  const stream={id:'real-camera'}; // adapter boundary checks media separately
  const joined=await sdk.joinPublicRoom(open.id,stream);
  assert.equal(joined.isStarted(),true);
  assert.equal(connected,true);
  assert.equal(events[0].name,'session:join');
  assert.equal(events[0].payload.sessionId,open.id);
  assert.equal(adapterCalls[0].roomId,open.id);
  assert.equal(adapterCalls[0].stream,stream);
  await sdk.leaveRoom();
  assert.ok(adapterCalls.includes('left'));
  await sdk.dispose();
});

test('closed/private room never claims rtc.connected',async()=>{
  for(const payload of [{...open,policy:{...open.policy,allowUnlistedParticipants:false}}, {...open,status:'ENDED'}]){
    const {socket,events}=socketFor(payload);
    const client=new HitelPublicRooms({socket,accessToken:'guest-token'});
    const sdk=CommunicationSDK.create({
      publicRooms:client,
      roomAdapter:{join:async()=>{throw new Error('should not be reached')}},
      nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}
    });
    let media=false;sdk.on(event=>{if(event.type==='rtc.connected')media=true});
    await assert.rejects(sdk.joinPublicRoom(open.id,{id:'camera'}),/공개 영상방/);
    assert.equal(media,false);
    assert.deepEqual(events.map(e=>e.name),['session:join','session:leave']);
    await sdk.dispose();
  }
});

test('RTC adapter failure releases existing session:join membership',async()=>{
  const {socket,events}=socketFor();
  const client=new HitelPublicRooms({socket,accessToken:'test'});
  const sdk=CommunicationSDK.create({
    publicRooms:client,
    roomAdapter:{join:async()=>{throw new Error('actual RTC failure')}},
    nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})}
  });
  await assert.rejects(sdk.joinPublicRoom(open.id,{id:'camera'}),/actual RTC failure/);
  assert.deepEqual(events.map(e=>e.name),['session:join','session:leave']);
  await sdk.dispose();
});
