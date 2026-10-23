export type NativeCapabilities = {
  nativeBridge: boolean; localTts: boolean; openSystemDialer: boolean;
  webrtcWebview: boolean; readCellularRemoteAudio: boolean; injectCellularAudio: boolean;
};
export type NativeReply = {
  requestId?: string; ok: boolean; platform?: string; bridgeVersion?: number;
  capabilities?: NativeCapabilities; scope?: string; error?: string;
};
type AndroidBridge = { postMessage: (data: string) => void; onmessage?: (event: { data: string }) => void };
declare global {
  interface Window {
    HitelNative?: AndroidBridge;
    webkit?: { messageHandlers?: { hitelNative?: { postMessage: (data: object) => void } } };
  }
}
const defaults: NativeCapabilities = {
  nativeBridge: false, localTts: 'speechSynthesis' in window, openSystemDialer: true,
  webrtcWebview: 'RTCPeerConnection' in window,
  readCellularRemoteAudio: false, injectCellularAudio: false
};
let sequence = 0;
const pending = new Map<string, { resolve: (reply: NativeReply) => void; reject: (error: Error) => void; timer: number }>();
function receive(reply: NativeReply) {
  if (!reply.requestId) return;
  const request = pending.get(reply.requestId);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(reply.requestId);
  if (reply.ok) request.resolve(reply);
  else request.reject(new Error(reply.error || 'Native call failed'));
}
window.addEventListener('hitel-native-response', event => receive((event as CustomEvent<NativeReply>).detail));
export function platform(): string {
  if (window.HitelNative) return 'android';
  if (window.webkit?.messageHandlers?.hitelNative) return 'ios';
  return 'browser';
}
export async function nativeCall(action: string, data: Record<string, unknown> = {}): Promise<NativeReply> {
  const os = platform();
  if (os === 'browser') {
    if (action === 'getCapabilities') return { ok: true, platform: os, capabilities: defaults };
    if (action === 'tts.speak' && window.speechSynthesis) {
      const speech = new SpeechSynthesisUtterance(String(data.text || '').slice(0, 1000));
      speech.lang = String(data.language || 'ko-KR');
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
      return { ok: true, scope: 'local-browser-only', platform: os };
    }
    if (action === 'tts.stop') { window.speechSynthesis?.cancel(); return { ok: true }; }
    if (action === 'call.openDialer') {
      const phone = String(data.phone || '');
      if (!/^[+0-9*# -]{1,24}$/.test(phone)) throw new Error('Invalid phone number');
      window.location.href = 'tel:' + encodeURIComponent(phone);
      return { ok: true };
    }
    throw new Error('HITEL native app required');
  }
  const id = 'native-' + Date.now() + '-' + (++sequence);
  return new Promise<NativeReply>((resolve, reject) => {
    const timer = window.setTimeout(() => { pending.delete(id); reject(new Error('Native response timeout')); }, 8000);
    pending.set(id, { resolve, reject, timer });
    const payload = { ...data, requestId: id, action };
    if (os === 'android' && window.HitelNative) {
      window.HitelNative.onmessage = event => {
        try { receive(JSON.parse(event.data) as NativeReply); } catch { /* ignore malformed reply */ }
      };
      window.HitelNative.postMessage(JSON.stringify(payload));
    } else {
      window.webkit?.messageHandlers?.hitelNative?.postMessage(payload);
    }
  });
}
