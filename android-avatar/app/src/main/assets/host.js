/* HITEL S2 Android first stage: DH_live mini on-device + WebRTC loopback.
 * Only the final composited canvas is sent. No remote signaling or cloud rendering.
 * Vendor engine is downloaded from a pinned upstream commit by sync_dhlive.py.
 */
'use strict';

const el = id => document.getElementById(id);
let ownAvatar = false;
let engineReady = false;
let activeSender = null;
let activeReceiver = null;
let loopStream = null;
let audioContext = null;

function status(message) {
  el('status').textContent = message;
  console.log('[HITEL]', message);
}
function rtcStatus(message) {
  el('rtc-status').textContent = message;
  console.log('[HITEL WebRTC]', message);
}
function indicator(message) { el('indicator').textContent = message; }

try {
  ownAvatar = Boolean(window.HitelAndroid?.hasAvatar?.());
} catch (e) {
  console.warn('Native avatar bridge unavailable:', e);
}
CONFIG.chromaKeyEnabled = false;
CONFIG.showFPS = true;
if (ownAvatar) {
  CONFIG.videoSrc = '/avatar/01.mp4';
  CONFIG.dataSrc = '/avatar/combined_data.json.gz';
}
status(ownAvatar ? '개인 아바타 자료를 불러오는 중입니다.' : '샘플 아바타 엔진을 불러오는 중입니다.');

// Runtime init is asynchronous. We deliberately do not mark ready until real
// video frame metadata, face mesh and WASM image compositor are present.
const readinessCheck = setInterval(() => {
  try {
    if (engineReady) { clearInterval(readinessCheck); return; }
    const ok = typeof Module !== 'undefined' &&
      typeof Module._processImage === 'function' &&
      typeof Module._setAudioBuffer === 'function' &&
      typeof videoProcessor !== 'undefined' &&
      videoProcessor.video?.readyState >= 2 &&
      typeof dataSets !== 'undefined' && dataSets.length > 0 &&
      el('canvas_video').width > 0;
    if (!ok) return;
    clearInterval(readinessCheck);
    engineReady = true;
    el('start-loopback').disabled = false;
    el('test-audio').disabled = false;
    el('wav').disabled = false;
    el('reset').disabled = false;
    indicator(ownAvatar ? '내 아바타 · 엔진 실행 중' : '데모 아바타 · 엔진 실행 중');
    status('실제 DH_live mini 아바타 엔진 초기화 완료. 내부 WebRTC 연결을 자동 시작합니다.');
    void startLoopback().catch(e => rtcStatus('WebRTC 자동 시작 실패: ' + e.message + ' · 다시 시작 버튼을 누를 수 있습니다.'));
  } catch (e) {
    clearInterval(readinessCheck);
    status('아바타 엔진 초기화 실패: ' + e.message);
  }
}, 250);
setTimeout(() => {
  if (!engineReady) status('엔진 초기화 지연: Android 로그 및 아바타 파일을 확인하세요.');
}, 30000);

function awaitIceGathering(pc, timeoutMs = 12000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer;
    const onChange = () => {
      if (pc.iceGatheringState !== 'complete') return;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      reject(new Error('로컬 ICE 수집 시간 초과'));
    }, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

async function stopLoopback() {
  const preview = el('rtc-preview');
  preview.pause();
  preview.srcObject = null;
  preview.hidden = true;
  activeSender?.close();
  activeReceiver?.close();
  activeSender = null;
  activeReceiver = null;
  loopStream?.getTracks().forEach(t => t.stop());
  loopStream = null;
  el('start-loopback').disabled = !engineReady;
  el('stop-loopback').disabled = true;
  indicator(ownAvatar ? '내 아바타 · 직접 렌더링' : '데모 아바타 · 직접 렌더링');
  rtcStatus('WebRTC 루프백이 중지됐습니다. 아바타 엔진은 계속 실행 중입니다.');
}

async function startLoopback() {
  if (!engineReady || activeSender) return;
  if (typeof RTCPeerConnection === 'undefined') throw new Error('이 WebView에 RTCPeerConnection이 없습니다.');
  const canvas = el('canvas_video');
  if (typeof canvas.captureStream !== 'function') throw new Error('이 Android WebView는 canvas.captureStream을 지원하지 않습니다.');
  try {
    loopStream = canvas.captureStream(25);
    const videoTrack = loopStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('아바타 캔버스 영상 트랙을 생성하지 못했습니다.');
    activeSender = new RTCPeerConnection({iceServers: []});
    activeReceiver = new RTCPeerConnection({iceServers: []});
    const receiver = activeReceiver;
    receiver.ontrack = event => {
      const preview = el('rtc-preview');
      if (event.track.kind !== 'video') return;
      preview.srcObject = event.streams[0] || new MediaStream([event.track]);
      preview.muted = true;
      preview.play().then(() => {
        preview.hidden = false;
        indicator('WebRTC 실제 수신 영상');
        rtcStatus('로컬 RTCPeerConnection 수신 성공. 아바타 프레임을 WebRTC로 표시하고 있습니다.');
      }).catch(e => rtcStatus('WebRTC 트랙 수신 후 영상 재생 실패: ' + e.message));
    };
    activeSender.onconnectionstatechange = () => {
      if (activeSender?.connectionState === 'failed') rtcStatus('WebRTC 송신 연결 실패');
    };
    activeSender.addTrack(videoTrack, loopStream);
    rtcStatus('로컬 SDP 교환 및 ICE 연결 중…');
    await activeSender.setLocalDescription(await activeSender.createOffer());
    await awaitIceGathering(activeSender);
    await receiver.setRemoteDescription(activeSender.localDescription);
    await receiver.setLocalDescription(await receiver.createAnswer());
    await awaitIceGathering(receiver);
    await activeSender.setRemoteDescription(receiver.localDescription);
    el('start-loopback').disabled = true;
    el('stop-loopback').disabled = false;
    rtcStatus('WebRTC SDP 교환 완료. 실제 비디오 프레임 수신을 기다리는 중…');
  } catch (e) {
    await stopLoopback();
    throw e;
  }
}

async function playAvatarWav(arrayBuffer, filename) {
  if (!engineReady) throw new Error('아바타 엔진 초기화 전입니다.');
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 44) throw new Error('유효한 WAV 파일이 아닙니다.');
  if (arrayBuffer.byteLength > 12 * 1024 * 1024) throw new Error('12MB 이하 WAV 파일을 사용하세요.');
  if (!audioContext) audioContext = new AudioContext();
  await audioContext.resume();
  const playback = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  // Real audio bytes are forwarded to the vendor model, not arbitrary mouth animation.
  const bytes = new Uint8Array(arrayBuffer);
  const ptr = Module._malloc(bytes.length);
  if (!ptr) throw new Error('WASM 오디오 메모리 할당 실패');
  try {
    Module.HEAPU8.set(bytes, ptr);
    Module._setAudioBuffer(ptr, bytes.length);
  } finally {
    Module._free(ptr);
  }
  const source = audioContext.createBufferSource();
  source.buffer = playback;
  source.connect(audioContext.destination);
  source.onended = () => status('음성 재생 완료: ' + filename);
  source.start();
  status('WAV 음성 입력 → 입술 움직임 추론 실행 중: ' + filename);
}

window.hitelAvatarImported = async (success, message) => {
  if (!success) { status('아바타 가져오기 실패: ' + message); return; }
  ownAvatar = true;
  await stopLoopback();
  try {
    isPaused = true;
    await new Promise(resolve => requestAnimationFrame(resolve)); // stop the old render loop
    CONFIG.videoSrc = '/avatar/01.mp4';
    CONFIG.dataSrc = '/avatar/combined_data.json.gz';
    isPaused = false;
    await newVideoTask();
    await startLoopback();
    indicator('내 아바타 · 엔진 실행 중');
    status('개인 아바타 설치 및 렌더링 시작. 직접 스트리밍을 시작하세요.');
  } catch (e) {
    isPaused = false;
    status('개인 아바타 실행 실패: ' + e.message);
  }
};

el('import').addEventListener('click', () => {
  if (!window.HitelAndroid?.importAvatarZip) {
    status('Android 앱에서만 ZIP 가져오기가 지원됩니다.');
    return;
  }
  window.HitelAndroid.importAvatarZip();
});
el('reset').addEventListener('click', async () => {
  try {
    await stopLoopback();
    isPaused = true;
    await new Promise(resolve => requestAnimationFrame(resolve));
    isPaused = false;
    await newVideoTask();
    await startLoopback();
    status('아바타 자료를 다시 읽고 WebRTC 내부 스트리밍을 시작했습니다.');
  } catch (e) {
    isPaused = false;
    status('아바타 다시 읽기 실패: ' + e.message);
  }
});
el('start-loopback').addEventListener('click', () => startLoopback().catch(e => {
  rtcStatus('WebRTC 시작 실패: ' + e.message);
}));
el('stop-loopback').addEventListener('click', () => { void stopLoopback(); });
el('test-audio').addEventListener('click', async () => {
  try {
    const response = await fetch('common/test.wav');
    if (!response.ok) throw new Error('테스트 WAV 다운로드 실패 (' + response.status + ')');
    await playAvatarWav(await response.arrayBuffer(), '샘플 음성');
  } catch (e) { status('WAV 처리 실패: ' + e.message); }
});
el('wav').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { await playAvatarWav(await file.arrayBuffer(), file.name); }
  catch (e) { status('WAV 처리 실패: ' + e.message); }
  event.target.value = '';
});
window.addEventListener('pagehide', () => {
  void stopLoopback();
  audioContext?.close();
});
