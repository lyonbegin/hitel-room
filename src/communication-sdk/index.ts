import { nativeCall, platform, type NativeCapabilities, type NativeReply } from '../portal/nativeBridge';

/**
 * Reuses HITEL's existing authenticated WebView Bridge.
 * Does not acquire PSTN audio, implement telephony gateways or replace VideoCore.
 */
export const COMMUNICATION_SDK_VERSION = '0.1.0';
export const DEFAULT_AI_COUNSELOR_URL =
  'https://ai-counselor-sdk-production.up.railway.app/sdk/ai-counselor.esm.js';
export const DEFAULT_AI_RUNTIME_URL =
  'https://ai-counselor-sdk-production.up.railway.app';

export type EndpointKind = 'P' | 'P+' | 'N' | 'W';
export type CommunicationEventType =
  | 'native.event' | 'native.error'
  | 'rtc.connecting' | 'rtc.connected' | 'rtc.disconnected' | 'rtc.error'
  | 'ai.ready' | 'ai.result' | 'ai.error';

export interface CommunicationEvent {
  type: CommunicationEventType;
  time: string;
  detail?: unknown;
}

export interface RouteDescription {
  id: number;
  from: EndpointKind;
  to: EndpointKind;
  nativeSdkActive: boolean;
  webRtcCandidate: boolean;
  externalConnectionRequired: boolean;
  independentAiSidecar: boolean;
}

export function describeRoute(from: EndpointKind, to: EndpointKind): RouteDescription {
  const order: EndpointKind[] = ['P', 'P+', 'N', 'W'];
  const source = order.indexOf(from);
  const target = order.indexOf(to);
  if (source < 0 || target < 0) throw new Error('Unknown communication endpoint');
  const entirelyCellular = from === 'P' && to === 'P';
  const webRtcCandidate = (from === 'N' || from === 'W') &&
    (to === 'N' || to === 'W');
  return {
    id: source * 4 + target + 1,
    from,
    to,
    nativeSdkActive: !entirelyCellular,
    webRtcCandidate,
    externalConnectionRequired: !entirelyCellular && !webRtcCandidate,
    independentAiSidecar: from === 'P+' || to === 'P+' ||
      webRtcCandidate,
  };
}

export interface CommunicationCapabilities {
  platform: 'android' | 'ios' | 'browser';
  native: NativeCapabilities;
  /** These describe potential local features, not granted microphone or phone-call audio access. */
  playLocalTts: boolean;
  canRequestWebRtcMedia: boolean;
  hearCellularRemoteAudio: boolean;
  injectCellularRemoteAudio: boolean;
}

export interface RoomSession {
  leave(): Promise<void> | void;
  // Optional media controls supplied by the existing HITEL mediasoup adapter.
  isStarted?(): boolean;
  replaceLocalTracks?(stream: MediaStream): Promise<void>;
  setMicrophoneEnabled?(enabled: boolean): Promise<void>;
  setCameraEnabled?(enabled: boolean): Promise<void>;
}

export interface RoomAdapter {
  join(options: {
    roomId: string;
    stream: MediaStream;
    sessionId?: string;
    profile?: Record<string, unknown>;
  }): Promise<RoomSession>;
}

export interface AIProfile {
  preset?: string;
  name?: string;
  role?: string;
  objective?: string;
  domain?: string;
  [key: string]: unknown;
}

interface AICounselorInstance {
  respond(text: string, context?: Record<string, unknown>): Promise<unknown>;
  enterRoom(options: {
    roomId: string;
    roomAdapter: RoomAdapter;
    cameraOptions?: Record<string, unknown>;
  }): Promise<RoomSession>;
  leaveRoom(): Promise<void>;
  getProfile(): AIProfile;
  stopCamera(): void;
}

interface AICounselorModule {
  AICounselor: { create(options: {
    endpoint: string;
    profile: AIProfile;
    sessionId?: string;
    roomAdapter?: RoomAdapter;
  }): AICounselorInstance };
}

export interface NativeBridgeAdapter {
  platform(): 'android' | 'ios' | 'browser';
  request(action: string, data?: Record<string, unknown>): Promise<NativeReply>;
}

const defaultBridge: NativeBridgeAdapter = {
  platform: () => platform() as 'android' | 'ios' | 'browser',
  request: nativeCall,
};

export interface CommunicationOptions {
  nativeBridge?: NativeBridgeAdapter;
  aiCounselorUrl?: string;
  aiRuntimeUrl?: string;
  profile?: AIProfile;
  roomAdapter?: RoomAdapter;
  sessionId?: string;
}

type Listener = (event: CommunicationEvent) => void;

/**
 * The host app owns identities, invitations and WebRTC room authorization.
 * The SDK coordinates native commands, room adapters and personal AI events.
 */
export class CommunicationSDK {
  static create(options: CommunicationOptions = {}) {
    return new CommunicationSDK(options);
  }

  private readonly listeners = new Set<Listener>();
  private readonly options: CommunicationOptions;
  private readonly bridge: NativeBridgeAdapter;
  private counselor?: AICounselorInstance;
  private counselorLoading?: Promise<AICounselorInstance>;
  private room?: RoomSession;
  private roomOwnedByAI = false;
  private nativeListener?: (event: Event) => void;

  constructor(options: CommunicationOptions = {}) {
    this.options = options;
    this.bridge = options.nativeBridge || defaultBridge;
    if (typeof window !== 'undefined') {
      this.nativeListener = (event: Event) => {
        this.emit('native.event', (event as CustomEvent<unknown>).detail);
      };
      window.addEventListener('hitel-native-event', this.nativeListener);
    }
  }

  get platform() { return this.bridge.platform(); }
  get version() { return COMMUNICATION_SDK_VERSION; }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: CommunicationEventType, detail?: unknown) {
    const event: CommunicationEvent = {
      type, time: new Date().toISOString(), detail,
    };
    this.listeners.forEach(listener => {
      try { listener(event); } catch (error) { console.error('Communication listener error', error); }
    });
  }

  async getCapabilities(): Promise<CommunicationCapabilities> {
    try {
      const reply = await this.bridge.request('getCapabilities');
      const native = reply.capabilities;
      if (!native) throw new Error('Bridge did not return capabilities');
      return {
        platform: this.platform,
        native,
        playLocalTts: native.localTts,
        canRequestWebRtcMedia:
          native.webrtcWebview && typeof navigator !== 'undefined' &&
          !!navigator.mediaDevices?.getUserMedia,
        hearCellularRemoteAudio: native.readCellularRemoteAudio,
        injectCellularRemoteAudio: native.injectCellularAudio,
      };
    } catch (error) {
      this.emit('native.error', String(error));
      throw error;
    }
  }

  async openSystemDialer(phone: string): Promise<void> {
    await this.bridge.request('call.openDialer', { phone });
  }

  async speakLocally(text: string, language = 'ko-KR'): Promise<void> {
    await this.bridge.request('tts.speak', { text, language });
  }

  async stopLocalSpeech(): Promise<void> {
    await this.bridge.request('tts.stop');
  }

  private async loadAICounselor(): Promise<AICounselorInstance> {
    if (this.counselor) return this.counselor;
    if (!this.counselorLoading) {
      this.counselorLoading = (async () => {
        // Directly import the actual AI Counselor SDK; it imports VideoCore itself.
        const sdk = await import(/* @vite-ignore */
          (this.options.aiCounselorUrl || DEFAULT_AI_COUNSELOR_URL)) as AICounselorModule;
        if (typeof sdk.AICounselor?.create !== 'function') {
          throw new Error('AI Counselor SDK entrypoint missing');
        }
        const counselor = sdk.AICounselor.create({
          endpoint: this.options.aiRuntimeUrl || DEFAULT_AI_RUNTIME_URL,
          profile: this.options.profile || { preset: 'generic' },
          sessionId: this.options.sessionId,
          roomAdapter: this.options.roomAdapter,
        });
        this.counselor = counselor;
        this.emit('ai.ready', { profile: counselor.getProfile() });
        return counselor;
      })().catch(error => {
        this.counselorLoading = undefined;
        this.emit('ai.error', String(error));
        throw error;
      });
    }
    return this.counselorLoading;
  }

  async respondWithAI(text: string, context: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const counselor = await this.loadAICounselor();
      const result = await counselor.respond(text, context);
      // Per-participant private result: no auto-send to peer or RTC transport.
      this.emit('ai.result', result);
      return result;
    } catch (error) {
      this.emit('ai.error', String(error));
      throw error;
    }
  }

  async joinRoom(roomId: string, stream: MediaStream, adapter = this.options.roomAdapter): Promise<RoomSession> {
    if (this.room) throw new Error('An active room already exists');
    if (!adapter) throw new Error('An actual WebRTC roomAdapter is required');
    if (!roomId.trim()) throw new Error('roomId is required');
    this.emit('rtc.connecting', { roomId });
    try {
      const room = await adapter.join({ roomId, stream });
      if (!room || typeof room.leave !== 'function') {
        throw new Error('WebRTC adapter did not return a valid room session');
      }
      this.room = room;
      this.roomOwnedByAI = false;
      this.emit('rtc.connected', { roomId });
      return room;
    } catch (error) {
      this.emit('rtc.error', String(error));
      throw error;
    }
  }

  async joinAICounselorRoom(roomId: string, adapter = this.options.roomAdapter): Promise<RoomSession> {
    if (this.room) throw new Error('An active room already exists');
    if (!adapter) throw new Error('An actual WebRTC roomAdapter is required');
    if (!roomId.trim()) throw new Error('roomId is required');
    this.emit('rtc.connecting', { roomId });
    try {
      const counselor = await this.loadAICounselor();
      // AICounselor.enterRoom -> VideoCore.openCamera -> the host WebRTC adapter.
      const room = await counselor.enterRoom({ roomId, roomAdapter: adapter });
      if (!room || typeof room.leave !== 'function') {
        throw new Error('AI Counselor room adapter did not return a valid room');
      }
      this.room = room;
      this.roomOwnedByAI = true;
      this.emit('rtc.connected', { roomId, ai: true });
      return room;
    } catch (error) {
      this.emit('rtc.error', String(error));
      throw error;
    }
  }

  async leaveRoom(): Promise<void> {
    const room = this.room;
    const ai = this.roomOwnedByAI;
    this.room = undefined;
    this.roomOwnedByAI = false;
    if (!room) return;
    try {
      if (ai) await this.counselor?.leaveRoom();
      else await room.leave();
    } finally {
      this.emit('rtc.disconnected');
    }
  }

  async dispose(): Promise<void> {
    await this.leaveRoom();
    this.counselor?.stopCamera();
    if (this.nativeListener && typeof window !== 'undefined') {
      window.removeEventListener('hitel-native-event', this.nativeListener);
    }
    this.listeners.clear();
  }
}

export function createCommunicationSDK(options: CommunicationOptions = {}) {
  return CommunicationSDK.create(options);
}
