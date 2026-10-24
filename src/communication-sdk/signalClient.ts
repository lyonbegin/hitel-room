/** Browser/Native-WebView client for the real signaling WebSocket. Never use a JS Bridge
 * for cross-device communication; native apps may speak the same protocol directly. */
export type CommunicationRole='caller'|'callee';
export type CommunicationCallState='idle'|'inviting'|'ringing'|'accepted'|
  'connecting'|'active'|'ended'|'rejected'|'cancelled'|'missed'|'failed';
export type CommunicationAction='call.invite'|'call.ringing'|'call.accept'|'call.reject'|
  'call.cancel'|'call.connecting'|'call.active'|'call.end'|'call.failed'|
  'call.networkInterrupted'|'call.recovered'|'call.mediaChanged'|'ai.result';
export interface CommunicationSignalEvent {
  type:string;eventId:string;callId:string;scenarioId:number;sequence:number;
  from:CommunicationRole|'server';state:CommunicationCallState;
  timestamp:string;payload:Record<string,unknown>;
}
export interface CommunicationSessionInfo {
  ok:boolean;callId:string;scenarioId:number;callerToken:string;calleeToken:string;expiresInSeconds:number;
}
export interface CommunicationSnapshot {
  ok:boolean;callId:string;scenarioId:number;from:string;to:string;
  role:CommunicationRole;state:CommunicationCallState;sequence:number;
  participants:{caller:{online:boolean};callee:{online:boolean}};
  events:CommunicationSignalEvent[];
}
type Listener=(event:CommunicationSignalEvent)=>void;
type ConnectionListener=(connected:boolean)=>void;
interface Pending {resolve:(value:{state:CommunicationCallState;sequence:number})=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}

/** Generates short-lived sandbox tokens. Production will replace this with authenticated invitations. */
export async function createCommunicationSession(from:string,to:string,baseUrl='/comm-api'):Promise<CommunicationSessionInfo>{
  const response=await fetch(baseUrl.replace(/\/$/,'')+'/session',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to})
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Cannot create call');
  return data as CommunicationSessionInfo;
}
export class CommunicationSignalClient {
  private readonly token:string;
  private readonly base:string;
  private socket?:WebSocket;
  private stopped=false;
  private reconnectTimer?:ReturnType<typeof setTimeout>;
  private readonly events=new Set<Listener>();
  private readonly status=new Set<ConnectionListener>();
  private readonly pending=new Map<string,Pending>();
  private lastSequence=0;
  private requestSequence=0;
  private opened=false;
  private connectionPromise?:Promise<void>;
  state:CommunicationCallState='idle';
  callId='';
  scenarioId=0;
  role?:CommunicationRole;
  constructor(token:string,baseUrl='/comm-api'){
    if(!token)throw new Error('Participant token is required');
    this.token=token;this.base=baseUrl.replace(/\/$/,'');
  }
  on(listener:Listener){this.events.add(listener);return ()=>this.events.delete(listener)}
  onConnection(listener:ConnectionListener){this.status.add(listener);return ()=>this.status.delete(listener)}
  get online(){return this.opened}
  get sequence(){return this.lastSequence}
  private notify(online:boolean){this.opened=online;for(const l of this.status)l(online)}
  private absoluteWsUrl(){
    const url=new URL(this.base+'/ws',location.href);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    url.searchParams.set('token',this.token);
    url.searchParams.set('since',String(this.lastSequence));
    return url.toString();
  }
  async snapshot():Promise<CommunicationSnapshot>{
    const response=await fetch(this.base+'/session/'+encodeURIComponent(this.callId),{
      headers:{Authorization:'Bearer '+this.token},cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Cannot load call');
    return data as CommunicationSnapshot;
  }
  connect():Promise<void>{
    if(this.opened)return Promise.resolve();
    if(this.connectionPromise)return this.connectionPromise;
    this.stopped=false;
    this.connectionPromise=new Promise<void>((resolve,reject)=>{
      let initial=true;
      const open=()=>{
        if(this.stopped)return;
        const ws=new WebSocket(this.absoluteWsUrl());
        this.socket=ws;
        ws.onopen=()=>{this.notify(true);if(initial){initial=false;resolve()}};
        ws.onmessage=(e)=>{
          let msg:any;try{msg=JSON.parse(String(e.data))}catch{return}
          if(msg.type==='comm.snapshot'){
            this.state=msg.state;this.callId=msg.callId;this.scenarioId=msg.scenarioId;this.role=msg.role;
            for(const event of (msg.events||[]) as CommunicationSignalEvent[])this.receiveEvent(event);
          }else if(msg.type==='comm.event'){this.receiveEvent(msg.event as CommunicationSignalEvent)}
          else if(msg.type==='comm.actionAck'){
            const p=this.pending.get(msg.requestId);
            if(p){clearTimeout(p.timer);this.pending.delete(msg.requestId);p.resolve({state:msg.state,sequence:msg.sequence})}
          }else if(msg.type==='comm.error'&&msg.requestId){
            const p=this.pending.get(msg.requestId);
            if(p){clearTimeout(p.timer);this.pending.delete(msg.requestId);p.reject(new Error(msg.error||'Signaling error'))}
          }
        };
        ws.onerror=()=>{/* onclose handles retry */};
        ws.onclose=()=>{
          if(this.socket!==ws)return;
          this.notify(false);
          for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Signaling socket closed'))}
          this.pending.clear();
          if(initial){initial=false;reject(new Error('Cannot establish signaling connection'))}
          if(!this.stopped)this.reconnectTimer=setTimeout(open,1500);
        };
      };
      open();
    }).finally(()=>{this.connectionPromise=undefined});
    return this.connectionPromise;
  }
  private receiveEvent(event:CommunicationSignalEvent){
    if(!event||event.sequence<=this.lastSequence)return;
    this.lastSequence=event.sequence;
    this.state=event.state;
    this.socket?.readyState===WebSocket.OPEN&&this.socket.send(JSON.stringify({type:'comm.ack',sequence:this.lastSequence}));
    for(const l of this.events){try{l(event)}catch(e){console.error('Communication event listener failed',e)}}
  }
  action(action:CommunicationAction,payload:Record<string,unknown>={}):Promise<{state:CommunicationCallState;sequence:number}>{
    if(this.socket?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Signaling socket is offline'));
    const requestId=String(++this.requestSequence)+'-'+Date.now();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Signaling ACK timeout'))},10_000);
      this.pending.set(requestId,{resolve,reject,timer});
      this.socket!.send(JSON.stringify({type:'call.action',action,payload,requestId}));
    });
  }
  close(){
    this.stopped=true;clearTimeout(this.reconnectTimer);
    this.socket?.close(1000,'Client closing');this.socket=undefined;
    this.notify(false);
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Client closed'))}
    this.pending.clear();this.connectionPromise=undefined;
  }
}
