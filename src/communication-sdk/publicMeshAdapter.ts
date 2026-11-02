import type { RoomAdapter, RoomSession } from './index';
import type { HitelPublicRooms } from './publicRooms';
import type { RemoteTile } from '../types';

type PeerInfo = {peerId:string;userId:string;name?:string};
type Message =
  | {type:'welcome';peerId:string;peers:PeerInfo[]}
  | ({type:'peer-joined'} & PeerInfo)
  | {type:'peer-left';peerId:string}
  | {type:'signal';from:string;userId:string;data:{description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit}}
  | {type:'room-ended'|'pong'};

interface Peer {
  pc:RTCPeerConnection;
  userId:string;
  stream:MediaStream;
  pending:RTCIceCandidateInit[];
}

export interface PublicMeshOptions {
  publicRooms: HitelPublicRooms;
  onRemote: (tiles:RemoteTile[])=>void;
  onStatus?: (status:string)=>void;
  onEnded?:()=>void;
  iceServers?:RTCIceServer[];
}

/**
 * Public room adapter for Railway HTTPS/WebSocket ingress.
 * Media flows browser-to-browser using standard RTCPeerConnection, not via
 * Railway's unsupported public UDP ingress. Optional TURN servers can be
 * provided for NATs where direct STUN connectivity fails.
 */
export function createPublicMeshRoomAdapter(options:PublicMeshOptions):RoomAdapter {
  if(options.publicRooms.transport!=='mesh') {
    throw new Error('Railway mesh adapter requires transport: mesh');
  }
  return {
    async join({roomId,stream}):Promise<RoomSession> {
      const ticket=options.publicRooms.takeTicket(roomId);
      const peers=new Map<string,Peer>();
      const ws=new WebSocket(options.publicRooms.signalingUrl(roomId),
        ['hitel-public','ticket.' + ticket]);
      let closed=false;
      let connected=false;
      let microphone=true,video=true;
      const serverIce=options.iceServers??[{urls:'stun:stun.l.google.com:19302'}];

      const emitTiles=()=>options.onRemote([...peers].filter(([,p])=>p.stream.getTracks().length>0)
        .map(([key,p])=>({key,userId:p.userId,source:'camera' as const,stream:p.stream})));
      function signal(to:string,data:Record<string,unknown>){
        if(ws.readyState!==WebSocket.OPEN) return;
        ws.send(JSON.stringify({type:'signal',to,data}));
      }
      function close(){
        if(closed)return;
        closed=true;
        for(const p of peers.values())p.pc.close();
        peers.clear();
        emitTiles();
        if(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)ws.close();
      }
      function peer(id:string,userId:string):Peer {
        const old=peers.get(id);
        if(old)return old;
        const pc=new RTCPeerConnection({iceServers:serverIce});
        const value:Peer={pc,userId,stream:new MediaStream(),pending:[]};
        peers.set(id,value);
        for(const track of stream.getTracks())pc.addTrack(track,stream);
        pc.onicecandidate=event=>{
          if(event.candidate)signal(id,{candidate:event.candidate.toJSON()});
        };
        pc.ontrack=event=>{
          const incoming=event.streams[0];
          if(incoming){
            for(const track of incoming.getTracks()){
              if(!value.stream.getTracks().includes(track))value.stream.addTrack(track);
            }
          } else if(!value.stream.getTracks().includes(event.track)){
            value.stream.addTrack(event.track);
          }
          emitTiles();
          event.track.onended=()=>{
            if(value.stream.getTracks().includes(event.track))value.stream.removeTrack(event.track);
            emitTiles();
          };
        };
        pc.onconnectionstatechange=()=>{
          if(pc.connectionState==='failed')options.onStatus?.('상대방과 직접 WebRTC 연결 실패 · TURN 서버가 필요할 수 있습니다.');
          if(pc.connectionState==='connected')options.onStatus?.('상대방 영상·음성 전송 경로 연결됨');
          if(pc.connectionState==='disconnected')options.onStatus?.('상대방 연결 일시 중단 · 재연결 확인 중');
        };
        return value;
      }
      async function handle(message:Message){
        if(closed)return;
        if(message.type==='welcome'){
          connected=true;
          for(const p of message.peers)peer(p.peerId,p.userId);
          options.onStatus?.('공개방 입장 완료 · 상대방 WebRTC 연결 대기 중');
          return;
        }
        if(message.type==='peer-joined'){
          const p=peer(message.peerId,message.userId);
          const offer=await p.pc.createOffer();
          await p.pc.setLocalDescription(offer);
          signal(message.peerId,{description:p.pc.localDescription?.toJSON()});
          return;
        }
        if(message.type==='peer-left'){
          peers.get(message.peerId)?.pc.close();
          peers.delete(message.peerId);emitTiles();
          return;
        }
        if(message.type==='room-ended'){
          options.onStatus?.('방장이 대화방을 종료했습니다.');
          close();options.onEnded?.();
          return;
        }
        if(message.type==='signal'){
          const p=peer(message.from,message.userId);
          if(message.data.description){
            await p.pc.setRemoteDescription(message.data.description);
            for(const candidate of p.pending.splice(0))await p.pc.addIceCandidate(candidate);
            if(message.data.description.type==='offer'){
              const answer=await p.pc.createAnswer();
              await p.pc.setLocalDescription(answer);
              signal(message.from,{description:p.pc.localDescription?.toJSON()});
            }
          }
          if(message.data.candidate){
            if(p.pc.remoteDescription)await p.pc.addIceCandidate(message.data.candidate);
            else p.pending.push(message.data.candidate);
          }
        }
      }
      await new Promise<void>((resolve,reject)=>{
        const timer=window.setTimeout(()=>reject(new Error('공개 영상방 WebSocket 연결 제한시간 초과')),12000);
        let resolved=false;
        ws.onmessage=event=>{
          try{
            const msg=JSON.parse(String(event.data)) as Message;
            if(msg.type==='welcome'&&!resolved){resolved=true;window.clearTimeout(timer);resolve();}
            void handle(msg).catch(e=>options.onStatus?.('WebRTC 시그널링 오류: '+String(e)));
          }catch(e){options.onStatus?.('WebRTC 메시지 오류: '+String(e));}
        };
        ws.onerror=()=>{if(!resolved){window.clearTimeout(timer);reject(new Error('공개 영상방 WebSocket 연결 실패'));}};
        ws.onclose=()=>{
          if(!resolved){window.clearTimeout(timer);reject(new Error('공개 영상방 연결이 종료되었습니다.'));}
          else if(!closed)options.onStatus?.('공개 영상방 신호 연결이 끊겼습니다.');
        };
      }).catch(e=>{close();throw e;});
      return {
        isStarted:()=>connected&&!closed,
        async leave(){close()},
        async replaceLocalTracks(next:MediaStream){
          for(const p of peers.values()){
            const senderTracks=p.pc.getSenders();
            for(const kind of ['video','audio'] as const){
              const newTrack=next.getTracks().find(t=>t.kind===kind)??null;
              const sender=senderTracks.find(s=>s.track?.kind===kind);
              if(sender)await sender.replaceTrack(newTrack);
              else if(newTrack)p.pc.addTrack(newTrack,next);
            }
          }
          stream=next;
        },
        async setMicrophoneEnabled(enabled:boolean){
          microphone=enabled;
          for(const track of stream.getAudioTracks())track.enabled=microphone;
        },
        async setCameraEnabled(enabled:boolean){
          video=enabled;
          for(const track of stream.getVideoTracks())track.enabled=video;
        }
      };
    }
  };
}
