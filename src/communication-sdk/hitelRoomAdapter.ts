import type { Socket } from 'socket.io-client';
import { MediasoupSession } from '../realtime/MediasoupSession';
import { emitAck } from '../realtime/socket';
import type { RemoteTile } from '../types';
import type { RoomAdapter, RoomSession } from './index';

/**
 * Real HITEL room adapter for the preexisting Fly/mediasoup service.
 *
 * Caller must use an authenticated/connected socket, join the permitted
 * HITEL consultation session and satisfy the existing server's ready/start
 * protocol BEFORE joining media. This adapter creates no fake room.
 */
export function createHitelRoomAdapter(
  socket: Socket,
  onRemote: (tiles: RemoteTile[]) => void,
  onStatus: (status: string) => void,
): RoomAdapter {
  return {
    async join({ roomId, stream }): Promise<RoomSession> {
      if (!socket.connected) throw new Error('HITEL realtime socket is not connected');
      if (!stream.getTracks().some(track => track.readyState === 'live')) {
        throw new Error('A live local media track is required');
      }
      const engine = new MediasoupSession(socket, roomId, onRemote, onStatus);
      try {
        // Actual rtc:join / SFU transports / producer and consumer signaling.
        await engine.start(stream, false);
      } catch (error) {
        await engine.dispose(false);
        throw error;
      }
      return {
        async leave() {
          try {
            await engine.dispose(true);
          } finally {
            // Existing session membership cleanup, not a PSTN call state.
            await emitAck(socket, 'session:leave', { sessionId: roomId }, 4000)
              .catch(() => undefined);
          }
        },
      };
    },
  };
}
