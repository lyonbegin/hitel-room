import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const room = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const media = readFileSync(new URL('../src/realtime/MediasoupSession.ts', import.meta.url), 'utf8');
const checks = [
  ['direct real WebRTC route', room.includes("'/webrtc-room'")],
  ['original camera default', room.includes("useState<CameraMode>('original')")],
  ['existing VideoCore mask button', room.includes('🎭 가면 영상')],
  ['start event triggers media join', /const started=.*?[\s\S]*?joinRtc\(streamRef\.current\)/.test(room)],
  ['joining a room already LIVE triggers media', room.includes("x.session.status==='LIVE'&&streamRef.current")],
  ['camera permission auto-ready', /const sdkCamera=await openVideoCoreCamera[\s\S]*?emitAck.*?'session:ready'/.test(room)],
  ['reconnected session re-joins', room.includes("rejoinNeeded") && room.includes("sock.on('connection:ready'")],
  ['rtc start concurrency guard', room.includes('rtcJoining.current')],
  ['transport cleanup on rtc failure', room.includes('await current.dispose(socket.current?.connected??false)')],
  ['remote end closes local camera', /const ended=.*?[\s\S]*?releaseCamera\(\)/.test(room)],
  ['manual end closes local camera', /async function end\(\).*?[\s\S]*?releaseCamera\(\)/.test(room)],
  ['leave closes media before session:leave', /async function exit\(\)[\s\S]*?await current\?\.dispose[\s\S]*?session:leave/.test(room)],
  ['original SFU protocol still referenced', media.includes("'rtc:join'") && media.includes("'rtc:produce'") && media.includes("'rtc:consume'")],
];
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  assert.ok(ok, label);
}
