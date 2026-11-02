import type { Socket } from 'socket.io-client';
import type { ConsultationSession } from '../types';
import { emitAck, waitForSocketReady } from '../realtime/socket';

/**
 * Public-room management for the EXISTING Fly realtime-session-server.
 *
 * API: GET/POST /public-rooms (same NestJS server, not a second room DB)
 * Admission: existing authenticated Socket.IO session:join
 * Media: existing rtc:join / mediasoup adapter (handled by CommunicationSDK).
 */
export class HitelPublicRooms {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly socket?: Socket;
  readonly transport: 'mediasoup' | 'mesh';
  private readonly pendingTickets = new Map<string,string>();

  constructor(options: { accessToken: string; socket?: Socket; baseUrl?: string; transport?: 'mediasoup'|'mesh' }) {
    if (!options.accessToken) throw new Error('Authenticated HITEL access token is required');
    this.accessToken = options.accessToken;
    this.socket = options.socket;
    this.transport = options.transport ?? 'mediasoup';
    if (this.transport === 'mediasoup' && !this.socket) {
      throw new Error('Original mediasoup signaling socket is required');
    }
    this.baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + this.accessToken);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(this.baseUrl + '/public-rooms' + path, {
      cache: 'no-store', ...init, headers,
    });
    let data: any;
    try { data = await response.json(); }
    catch { throw new Error('HITEL 공개방 서버 응답이 올바르지 않습니다.'); }
    if (!response.ok) {
      const message = Array.isArray(data?.message) ? data.message.join('; ') : data?.message;
      throw new Error(String(message || data?.error || 'HITEL 공개방 요청 실패: HTTP ' + response.status));
    }
    return data as T;
  }

  /** All users see the same list from the original Fly session store. */
  list(): Promise<ConsultationSession[]> {
    return this.request<ConsultationSession[]>('');
  }

  get(roomId: string): Promise<ConsultationSession> {
    if (!roomId.trim()) throw new Error('roomId is required');
    return this.request<ConsultationSession>('/' + encodeURIComponent(roomId));
  }

  /** One authenticated host, no invitee/userId list; automatically LIVE. */
  async create(options: { title: string; maxParticipants?: number }): Promise<ConsultationSession> {
    const title = options.title.trim();
    if (!title) throw new Error('Room title is required');
    return this.request<ConsultationSession>('', {
      method: 'POST',
      body: JSON.stringify({title, ...(options.maxParticipants ? {maxParticipants: options.maxParticipants} : {})}),
    });
  }

  /** The existing socket gateway grants GUEST membership when policy permits. */
  async enter(roomId: string): Promise<ConsultationSession> {
    if (!roomId.trim()) throw new Error('roomId is required');
    let session: ConsultationSession;
    if (this.transport === 'mesh') {
      const result = await this.request<{session: ConsultationSession; ticket: string}>(
        '/' + encodeURIComponent(roomId) + '/join', {method:'POST'},
      );
      if (!result.ticket) throw new Error('공개방 시그널링 접속권이 발급되지 않았습니다.');
      this.pendingTickets.set(roomId, result.ticket);
      session = result.session;
    } else {
      const socket = this.socket!;
      await waitForSocketReady(socket);
      const response = await emitAck<{session: ConsultationSession}>(socket, 'session:join', {sessionId: roomId});
      session = response.session;
    }
    if (session?.id !== roomId || session.type !== 'PUBLIC_ROOM' ||
        session.policy?.allowUnlistedParticipants !== true ||
        session.status !== 'LIVE') {
      await this.leave(roomId).catch(() => undefined);
      throw new Error('해당 방은 현재 입장 가능한 공개 영상방이 아닙니다.');
    }
    return session;
  }

  async leave(roomId: string): Promise<void> {
    this.pendingTickets.delete(roomId);
    if (this.transport === 'mesh') return; // Mesh adapter closes peer WebSocket.
    const socket = this.socket;
    if (!socket?.connected) return;
    await emitAck(socket, 'session:leave', {sessionId: roomId}, 4000);
  }

  /** WebSocket ticket is short-lived, one use and bound to this authenticated user. */
  takeTicket(roomId: string): string {
    const ticket = this.pendingTickets.get(roomId);
    if (!ticket) throw new Error('공개방 입장권이 없습니다.');
    this.pendingTickets.delete(roomId);
    return ticket;
  }

  signalingUrl(roomId: string, ticket: string): string {
    const relative = this.baseUrl + '/public-rooms/' + encodeURIComponent(roomId) +
      '/signal?ticket=' + encodeURIComponent(ticket);
    const url = new URL(relative, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  }

  async end(roomId: string): Promise<ConsultationSession> {
    if (!roomId.trim()) throw new Error('roomId is required');
    if (this.transport === 'mesh') {
      const response = await this.request<{session: ConsultationSession}>(
        '/' + encodeURIComponent(roomId) + '/end', {method:'POST'},
      );
      return response.session;
    }
    const socket = this.socket!;
    await waitForSocketReady(socket);
    const response = await emitAck<{session: ConsultationSession}>(
      socket, 'session:end', {sessionId: roomId},
    );
    return response.session;
  }
}

export function createHitelPublicRooms(options: ConstructorParameters<typeof HitelPublicRooms>[0]): HitelPublicRooms {
  return new HitelPublicRooms(options);
}
