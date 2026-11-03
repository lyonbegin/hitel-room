// This smoke test never creates, joins, ends, or modifies a room.
// It requests the same development JWT as the deployed web login and
// reads the authoritative Railway public-room listing through its proxy.
import assert from 'node:assert/strict';

const origin = process.env.HITEL_WEB_ORIGIN
  || 'https://hitel-room-production-ecce.up.railway.app';
const userId = 'native-readonly-smoke-' + process.pid;
const fail = (step, response) => {
  throw new Error(step + ': HTTP ' + response.status + ' ' + response.statusText);
};

const authResponse = await fetch(origin + '/api/auth/dev-token', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    userId,
    name: 'HITEL native API contract verification',
    platformRole: 'user'
  }),
  signal: AbortSignal.timeout(15000)
});
if (!authResponse.ok) fail('web-compatible user JWT', authResponse);
const auth = await authResponse.json();
assert.equal(typeof auth.accessToken, 'string', 'Expected web JWT accessToken');
assert.ok(auth.accessToken.length > 10);
console.log('HITEL_WEB_SHARED_JWT_OK');

const listResponse = await fetch(origin + '/api/public-rooms', {
  headers: {authorization: 'Bearer ' + auth.accessToken},
  signal: AbortSignal.timeout(15000)
});
if (!listResponse.ok) fail('Railway public room GET', listResponse);
const rooms = await listResponse.json();
assert.ok(Array.isArray(rooms), 'Public room listing must return an array');
for (const room of rooms) {
  assert.equal(typeof room.id, 'string');
  assert.equal(typeof room.status, 'string');
}
console.log('HITEL_RAILWAY_PUBLIC_ROOMS_READ_OK count=' + rooms.length);
console.log('HITEL_PUBLIC_ROOM_SMOKE_READONLY_PASS');
