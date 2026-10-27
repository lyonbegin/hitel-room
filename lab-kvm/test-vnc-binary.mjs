// Smoke test the exact WebSocket protocol used by the live runner to websockify.
// Unlike a bare TCP RFB banner check, this catches WebSocket subprotocol/frame issues.
const ws = new WebSocket('ws://127.0.0.1:6080/websockify', ['binary']);
ws.binaryType='arraybuffer';
const timeout=setTimeout(()=>{console.error('VNC_BINARY_PROTOCOL_TIMEOUT');process.exit(2)},12000);
ws.addEventListener('error',event=>{console.error('VNC_BINARY_PROTOCOL_ERROR',String(event?.message||'unknown'));process.exit(3)});
ws.addEventListener('open',()=>{
 if(ws.protocol!=='binary')throw Error('VNC_BINARY_SUBPROTOCOL_NOT_NEGOTIATED:'+ws.protocol);
 console.log('VNC_BINARY_SUBPROTOCOL_CONFIRMED',ws.protocol);
});
ws.addEventListener('message',event=>{
 if(!(event.data instanceof ArrayBuffer))throw Error('VNC_BINARY_FRAME_NOT_ARRAYBUFFER');
 const data=Buffer.from(event.data);
 const banner=data.subarray(0,12).toString('ascii');
 if(!banner.startsWith('RFB 003.'))throw Error('VNC_INVALID_RFB_BANNER:'+banner);
 console.log('VNC_BINARY_FRAME_RFB_BANNER_PASS',banner.trim());
 clearTimeout(timeout);ws.close();process.exit(0);
});
