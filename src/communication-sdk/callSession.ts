import type { CommunicationSDK, RoomAdapter, RoomSession } from './index';
import { CommunicationSignalClient, type CommunicationSignalEvent,
  type CommunicationCallState, type CommunicationAction } from './signalClient';

/** One call = one session object. Server validates actor role and all call-state transitions. */
export class CommunicationCallSession {
  readonly signaling:CommunicationSignalClient;
  private readonly sdk:CommunicationSDK;
  private media?:RoomSession;
  private eventListeners=new Set<(event:CommunicationSignalEvent)=>void>();
  private readonly unbind:()=>void;
  constructor(sdk:CommunicationSDK,participantToken:string,baseUrl='/comm-api'){
    this.sdk=sdk;
    this.signaling=new CommunicationSignalClient(participantToken,baseUrl);
    this.unbind=this.signaling.on(event=>{
      if(['call.end','call.reject','call.cancel','call.failed','call.missed'].includes(event.type)){
        this.media=undefined;
        void this.sdk.leaveRoom().catch(e=>console.error('Media cleanup failed',e));
      }
      for(const listener of this.eventListeners)listener(event);
    });
  }
  get state():CommunicationCallState{return this.signaling.state}
  get callId(){return this.signaling.callId}
  on(listener:(event:CommunicationSignalEvent)=>void){
    this.eventListeners.add(listener);return ()=>this.eventListeners.delete(listener);
  }
  connect(){return this.signaling.connect()}
  private dispatch(action:CommunicationAction,payload:Record<string,unknown>={}){
    return this.signaling.action(action,payload);
  }
  invite(payload:Record<string,unknown>={}){return this.dispatch('call.invite',payload)}
  ringing(){return this.dispatch('call.ringing')}
  accept(){return this.dispatch('call.accept')}
  reject(reason='rejected'){return this.dispatch('call.reject',{reason})}
  cancel(reason='cancelled'){return this.dispatch('call.cancel',{reason})}
  connecting(){return this.dispatch('call.connecting')}
  active(){return this.dispatch('call.active')}
  failed(reason:string){return this.dispatch('call.failed',{reason})}
  mediaChanged(data:Record<string,unknown>){return this.dispatch('call.mediaChanged',data)}
  networkInterrupted(){return this.dispatch('call.networkInterrupted')}
  recovered(){return this.dispatch('call.recovered')}
  /** Transition to ACTIVE only when the injected real RTC adapter finished joining. */
  async connectMedia(roomId:string,stream:MediaStream,adapter:RoomAdapter):Promise<RoomSession>{
    await this.connecting();
    try{
      const room=await this.sdk.joinRoom(roomId,stream,adapter);
      if(room.isStarted&&room.isStarted()!==true)throw new Error('RTC adapter is not started');
      this.media=room;
      await this.active();
      return room;
    }catch(e){
      await this.sdk.leaveRoom().catch(()=>undefined);
      await this.failed(e instanceof Error?e.message:String(e)).catch(()=>undefined);
      throw e;
    }
  }
  async end(reason='normal'){
    if(['ended','cancelled','rejected','missed','failed'].includes(this.state))return;
    if(['idle'].includes(this.state))return;
    if(['inviting','ringing'].includes(this.state)){
      if(this.signaling.role==='caller')await this.cancel(reason);
      else await this.reject(reason);
    }else await this.dispatch('call.end',{reason});
    await this.sdk.leaveRoom();
  }
  async dispose(){
    this.unbind();this.signaling.close();await this.sdk.leaveRoom();
    this.eventListeners.clear();
  }
}
export function createCommunicationCallSession(sdk:CommunicationSDK,participantToken:string,baseUrl='/comm-api'){
  return new CommunicationCallSession(sdk,participantToken,baseUrl);
}
