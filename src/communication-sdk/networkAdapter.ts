import type { NativeBridgeAdapter } from './index';
import type { NativeReply } from '../portal/nativeBridge';

/**
 * Network-native Bridge: The web browser never invokes an Android/iOS JS Bridge.
 * The caller posts authorized HTTPS commands. Railway relays them on an
 * authenticated WSS channel; the installed native app returns requestId results.
 */
export type NetworkSide = 'android' | 'ios';
export type NetworkCommand =
  | 'ping' | 'getCapabilities' | 'tts.speak' | 'tts.stop' | 'call.openDialer'
  | 'home' | 'back' | 'reload' | 'launch' | 'navigate';

export interface NetworkPair {
  ticket: string;
  controller: string;
  expiresInSeconds: number;
  side: 'both' | NetworkSide;
}

export class CommunicationNetworkAdapter implements NativeBridgeAdapter {
  private readonly baseUrl: string;
  private readonly controller: string;
  private readonly side: NetworkSide;
  constructor(side: NetworkSide, controller: string, baseUrl = '/lab-api') {
    if (!controller) throw new Error('Authorized device pairing token is required');
    this.side = side;
    this.controller = controller;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  platform(): 'android' | 'ios' { return this.side; }
  private async api<T>(path: string, init: RequestInit = {}): Promise<{status:number;data:T}> {
    const response = await fetch(this.baseUrl + path, {
      cache: 'no-store',
      ...init,
      headers: {
        Authorization: 'Bearer ' + this.controller,
        ...(init.body ? {'Content-Type': 'application/json'} : {}),
        ...(init.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Network command failed: ' + response.status);
    return {status:response.status,data};
  }
  async request(action: string, data: Record<string, unknown> = {}): Promise<NativeReply> {
    const {data:ack} = await this.api<{requestId: string}>('/command', {
      method:'POST',body:JSON.stringify({device:this.side,action,data}),
    });
    if (!ack.requestId) throw new Error('Network command missing requestId');
    const deadline=Date.now()+8000;
    while(Date.now()<deadline) {
      const outcome=await this.api<NativeReply & {status?: string}>('/result/'+encodeURIComponent(ack.requestId));
      if(outcome.status===200) {
        if(outcome.data.ok===false)throw new Error(outcome.data.error||'Native network command failed');
        return outcome.data;
      }
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw new Error('Native network response timeout (8 seconds)');
  }
  async navigate(screen: 'home'|'sdk'|'ai'|'call'|'media'): Promise<void> {
    await this.api('/command',{method:'POST',body:JSON.stringify({device:this.side,action:'navigate',screen})});
  }
}

export async function createCommunicationNetworkPair(
  side: NetworkSide|'both' = 'both', baseUrl = '/lab-api'
): Promise<NetworkPair> {
  const response=await fetch(baseUrl.replace(/\/$/,'')+'/pair',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({side}),
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Network pair failed');
  return result as NetworkPair;
}

export function createCommunicationNetworkBridge(
  side: NetworkSide, controller: string, baseUrl = '/lab-api'
): NativeBridgeAdapter {
  return new CommunicationNetworkAdapter(side,controller,baseUrl);
}
