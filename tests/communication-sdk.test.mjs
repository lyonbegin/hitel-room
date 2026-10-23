import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// SDK is built for WebView; provide only a minimal browser event surface.
const events = new EventTarget();
globalThis.window = {
  addEventListener: (...args) => events.addEventListener(...args),
  removeEventListener: (...args) => events.removeEventListener(...args),
  dispatchEvent: (...args) => events.dispatchEvent(...args),
};
const {
  CommunicationSDK,
  COMMUNICATION_SDK_VERSION,
  describeRoute,
} = await import(pathToFileURL(resolve('dist/sdk/communication.esm.js')).href);

test('16 communication scenarios map to a complete ordered 4x4 matrix', () => {
  const kinds = ['P', 'P+', 'N', 'W'];
  const routes = kinds.flatMap(from => kinds.map(to => describeRoute(from, to)));
  assert.deepEqual(routes.map(r => r.id), Array.from({length: 16}, (_,i) => i + 1));
  assert.equal(describeRoute('P', 'P').nativeSdkActive, false);
  for (const from of ['N','W']) for (const to of ['N','W']) {
    const route=describeRoute(from,to);
    assert.equal(route.webRtcCandidate,true);
    assert.equal(route.externalConnectionRequired,false);
  }
  assert.equal(describeRoute('P+','P').externalConnectionRequired,true);
  assert.equal(describeRoute('P','W').externalConnectionRequired,true);
  assert.throws(()=>describeRoute('invalid','P'));
});

test('native commands and capabilities travel through the injected real-format Bridge API', async () => {
  assert.ok(COMMUNICATION_SDK_VERSION);
  const calls = [];
  const sdk = CommunicationSDK.create({
    nativeBridge: {
      platform: () => 'android',
      request: async (action,data={}) => {
        calls.push({action,data});
        if(action==='getCapabilities')return {
          ok:true,platform:'android',
          capabilities:{
            nativeBridge:true,localTts:true,openSystemDialer:true,
            webrtcWebview:true,readCellularRemoteAudio:false,injectCellularAudio:false
          }
        };
        return {ok:true,platform:'android'};
      }
    }
  });
  const caps=await sdk.getCapabilities();
  assert.equal(caps.platform,'android');
  assert.equal(caps.hearCellularRemoteAudio,false);
  assert.equal(caps.injectCellularRemoteAudio,false);
  await sdk.openSystemDialer('01012345678');
  await sdk.speakLocally('안녕하세요', 'ko-KR');
  await sdk.stopLocalSpeech();
  assert.deepEqual(calls.map(c=>c.action), [
    'getCapabilities','call.openDialer','tts.speak','tts.stop'
  ]);
  assert.deepEqual(calls[1].data,{phone:'01012345678'});
  assert.equal(calls[2].data.text,'안녕하세요');
  await sdk.dispose();
});

test('two independent N/N SDK instances never share room or private AI events', async () => {
  let joins=0,leaves=0;
  const makeAdapter=()=>({join: async ({roomId,stream})=>{
    assert.equal(roomId,'session-test');
    assert.equal(stream.id,'stream-a');
    joins++;
    return {leave: async()=>{leaves++}};
  }});
  const makeSdk=()=>CommunicationSDK.create({
    nativeBridge: {platform:()=> 'browser',request:async()=>({ok:true})},
  });
  const a=makeSdk(), b=makeSdk();
  const aEvents=[],bEvents=[];
  a.on(e=>aEvents.push(e.type));b.on(e=>bEvents.push(e.type));
  await a.joinRoom('session-test',{id:'stream-a'},makeAdapter());
  assert.equal(joins,1);
  assert.equal(aEvents.includes('rtc.connected'),true);
  assert.equal(bEvents.includes('rtc.connected'),false);
  await assert.rejects(()=>a.joinRoom('session-test',{id:'stream-a'},makeAdapter()), /already exists/);
  await b.joinRoom('session-test',{id:'stream-a'},makeAdapter());
  assert.equal(joins,2);
  await Promise.all([a.leaveRoom(),b.leaveRoom()]);
  assert.equal(leaves,2);
  await Promise.all([a.dispose(),b.dispose()]);
});

test('actual AI Counselor import boundary is invoked, not a VideoCore copy', async()=>{
  const fakeModule=[
    'export const AICounselor={create(options){',
    'const profile=options.profile;',
    'return {getProfile(){return profile},',
    'respond:async(text)=>({reply:"AI:"+text}),',
    'enterRoom:async({roomId,roomAdapter})=>roomAdapter.join({roomId,stream:{id:"video-core-track"}}),',
    'leaveRoom:async()=>{},stopCamera(){}};',
    '}};'
  ].join('');
  const aiCounselorUrl='data:text/javascript,'+encodeURIComponent(fakeModule);
  const sdk=CommunicationSDK.create({
    aiCounselorUrl,
    profile:{name:'독립 상담사',preset:'generic'},
    nativeBridge:{platform:()=> 'browser',request:async()=>({ok:true})},
  });
  const events=[];sdk.on(e=>events.push(e));
  const result=await sdk.respondWithAI('테스트');
  assert.deepEqual(result,{reply:'AI:테스트'});
  assert.equal(events.some(e=>e.type==='ai.result'),true);
  let joined=false;
  await sdk.joinAICounselorRoom('AI-room',{join:async({roomId})=>{
    assert.equal(roomId,'AI-room');
    joined=true;
    return {leave:async()=>{}};
  }});
  assert.equal(joined,true);
  assert.equal(events.some(e=>e.type==='rtc.connected'),true);
  await sdk.dispose();
});
