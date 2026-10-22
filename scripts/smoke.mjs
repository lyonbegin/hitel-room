import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const base = process.env.SMOKE_ORIGIN || 'https://hitel-room.fly.dev';
const timeout = 12000;
async function verify(role, suffix) {
  const login = await fetch(base + '/api/auth/dev-token', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({userId: 'hitel-smoke-' + suffix, name: 'Hitel Smoke', platformRole: role}),
    signal: AbortSignal.timeout(timeout)
  });
  assert.ok(login.status === 200 || login.status === 201, 'login HTTP '+login.status);
  const body = await login.json();
  assert.equal(typeof body.accessToken, 'string', 'missing accessToken in login response');
  assert.ok(body.accessToken.length > 20, 'invalid token length');
  console.log(role + ': LOGIN_OK HTTP ' + login.status);

  const list = await fetch(base + '/api/telemedicine/consultations/me', {
    headers: {authorization: 'Bearer ' + body.accessToken},
    signal: AbortSignal.timeout(timeout)
  });
  assert.equal(list.status, 200, role + ': authenticated consultation listing HTTP ' + list.status);
  console.log(role + ': AUTHENTICATED_LIST_OK');

  const socket = io(base + '/realtime', {transports:['websocket'], auth:{token:body.accessToken}, autoConnect:false, reconnection:false, timeout});
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(role + ': socket namespace ready timed out')), timeout);
      function done(err) {
        clearTimeout(timer);
        socket.off('connection:ready', ready);
        socket.off('connection:error', fail);
        socket.off('connect_error', fail);
        if (err) reject(err); else resolve();
      }
      function ready() { done(); }
      function fail(x) { done(new Error(role + ': socket error: ' + (x?.message || String(x)))); }
      socket.once('connection:ready', ready);
      socket.once('connection:error', fail);
      socket.once('connect_error', fail);
      socket.connect();
    });
    console.log(role + ': SOCKET_IO_READY_OK');
  } finally { socket.disconnect(); }
}
await verify('doctor', 'host');
await verify('user', 'guest');
console.log('HITEL_ROOM_SMOKE_OK');
