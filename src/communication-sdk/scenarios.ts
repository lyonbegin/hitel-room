import type { CommunicationSDK } from './index';
import { describeRoute, type EndpointKind } from './index';
import { CommunicationCallSession } from './callSession';

/** App-controlled PSTN integration: no PSTN gateway, cellular-audio capture,
 * or system telephony call state is implemented inside Communication SDK. */
export interface CarrierAppAdapter {
  /** An actual supported native-OS incoming call event, not a simulated event. */
  attachIncomingSidecar(context:ScenarioExecutionContext):Promise<unknown>;
  /** The OS dialer opening does not prove a PSTN conversation was established. */
  dialCarrierNumber(context:ScenarioExecutionContext):Promise<unknown>;
  /** Mutual explicit sidecar consent for two local AI instances. */
  pairSidecars(context:ScenarioExecutionContext):Promise<unknown>;
}
export interface PhoneGatewayAdapter {
  /** Existing/native-app bridged PSTN ingress. Must return the external leg state. */
  incomingPstn(context:ScenarioExecutionContext):Promise<unknown>;
  /** Existing/native-app bridged PSTN outbound leg. */
  outgoingPstn(context:ScenarioExecutionContext):Promise<unknown>;
}
export type ScenarioExecutionStatus='external-unmanaged'|'native-sidecar-started'|
  'gateway-requested'|'signaling-connected';
export interface ScenarioExecutionContext {
  sdk:CommunicationSDK;
  from:EndpointKind;
  to:EndpointKind;
  role:'caller'|'callee';
  participantToken?:string;
  phoneNumber?:string;
  baseUrl?:string;
  carrier?:CarrierAppAdapter;
  gateway?:PhoneGatewayAdapter;
}
export interface ScenarioExecutionResult {
  scenarioId:number;
  status:ScenarioExecutionStatus;
  route:'carrier'|'sidecar'|'gateway'|'webrtc';
  externalResult?:unknown;
  session?:CommunicationCallSession;
}
/** The sixteen separately registered execution routes are deliberately explicit.
 * Missing platform integrations throw; they never resolve as a connected call. */
type Executor=(ctx:ScenarioExecutionContext,id:number)=>Promise<ScenarioExecutionResult>;
const error=(id:number,name:string):never=>{throw new Error('Scenario '+id+' requires a real '+name+' adapter')};
const unmanaged:Executor=async(_ctx,id)=>({scenarioId:id,status:'external-unmanaged',route:'carrier'});
const incomingSidecar:Executor=async(ctx,id)=>{
  if(!ctx.carrier)error(id,'native carrier');
  const externalResult=await ctx.carrier.attachIncomingSidecar(ctx);
  return {scenarioId:id,status:'native-sidecar-started',route:'sidecar',externalResult};
};
const outgoingSidecar:Executor=async(ctx,id)=>{
  if(!ctx.carrier)error(id,'native carrier');
  if(!ctx.phoneNumber)throw new Error('Phone number is required for carrier dialing');
  const externalResult=await ctx.carrier.dialCarrierNumber(ctx);
  return {scenarioId:id,status:'native-sidecar-started',route:'sidecar',externalResult};
};
const pairedSidecar:Executor=async(ctx,id)=>{
  if(!ctx.carrier)error(id,'native carrier');
  if(!ctx.phoneNumber)throw new Error('Phone number is required for carrier dialing');
  await ctx.carrier.dialCarrierNumber(ctx);
  const externalResult=await ctx.carrier.pairSidecars(ctx);
  return {scenarioId:id,status:'native-sidecar-started',route:'sidecar',externalResult};
};
const gatewayIncoming:Executor=async(ctx,id)=>{
  if(!ctx.gateway)error(id,'PSTN ingress');
  const externalResult=await ctx.gateway.incomingPstn(ctx);
  return {scenarioId:id,status:'gateway-requested',route:'gateway',externalResult};
};
const gatewayOutgoing:Executor=async(ctx,id)=>{
  if(!ctx.gateway)error(id,'PSTN outbound');
  const externalResult=await ctx.gateway.outgoingPstn(ctx);
  return {scenarioId:id,status:'gateway-requested',route:'gateway',externalResult};
};
const webrtc:Executor=async(ctx,id)=>{
  if(!ctx.participantToken)throw new Error('Scenario '+id+' requires a real signaling participant token');
  const session=new CommunicationCallSession(ctx.sdk,ctx.participantToken,ctx.baseUrl);
  try{
    await session.connect();
    if(session.signaling.scenarioId!==id)throw new Error('Signaling scenario does not match requested route');
    if(session.signaling.role!==ctx.role)throw new Error('Signaling token role mismatch');
    return {scenarioId:id,status:'signaling-connected',route:'webrtc',session};
  }catch(e){await session.dispose();throw e}
};
export const scenarioExecutors:Readonly<Record<number,Executor>>=Object.freeze({
  1:unmanaged,         // P  -> P : no SDK involvement
  2:incomingSidecar,   // P  -> P+
  3:gatewayIncoming,   // P  -> N
  4:gatewayIncoming,   // P  -> W
  5:outgoingSidecar,   // P+ -> P
  6:pairedSidecar,     // P+ -> P+
  7:gatewayOutgoing,   // P+ -> N
  8:gatewayOutgoing,   // P+ -> W
  9:gatewayOutgoing,   // N  -> P
  10:gatewayOutgoing,  // N  -> P+
  11:webrtc,           // N  -> N
  12:webrtc,           // N  -> W
  13:gatewayOutgoing,  // W  -> P
  14:gatewayOutgoing,  // W  -> P+
  15:webrtc,           // W  -> N
  16:webrtc,           // W  -> W
});
export async function executeCommunicationScenario(ctx:ScenarioExecutionContext):Promise<ScenarioExecutionResult>{
  const id=describeRoute(ctx.from,ctx.to).id;
  const run=scenarioExecutors[id];
  if(!run)throw new Error('No implementation registered for scenario '+id);
  return run(ctx,id);
}
