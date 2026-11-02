import type { ConsultationSession } from '../types';

export interface PublicRoom {
  id: string;
  title: string;
  hostUserId: string;
  maxParticipants: number;
  createdAt: number;
  status: 'OPEN' | 'CLOSED' | 'EXPIRED';
}

const API = '/room-directory/rooms';

async function request<T>(path:string, init:RequestInit={}, token?:string):Promise<T>{
  const headers = new Headers(init.headers);
  if(init.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  if(token) headers.set('Authorization', 'Bearer '+token);
  let response:Response;
  try {
    response = await fetch(API + path, {...init, headers, cache:'no-store'});
  } catch {
    throw new Error('공개 방 목록 서버에 연결할 수 없습니다.');
  }
  let body:any;
  try { body = await response.json(); }
  catch { throw new Error('공개 방 목록 서버의 응답 형식이 올바르지 않습니다.'); }
  if(!response.ok) throw new Error(String(body?.error || '공개 방 서버 오류 ('+response.status+')'));
  return body as T;
}

export async function listPublicRooms():Promise<PublicRoom[]>{
  const response=await request<{rooms:PublicRoom[]}>('');
  return response.rooms;
}

export async function publishPublicRoom(token:string, session:ConsultationSession, hostUserId:string):Promise<PublicRoom>{
  const response=await request<{room:PublicRoom}>('',{
    method:'POST',
    body:JSON.stringify({id:session.id, hostUserId})
  }, token);
  return response.room;
}

export async function enterPublicRoom(token:string, roomId:string):Promise<ConsultationSession>{
  const response=await request<{session:ConsultationSession}>('/'+encodeURIComponent(roomId)+'/join',{
    method:'POST',body:'{}'
  },token);
  return response.session;
}

export async function closePublicRoom(token:string, roomId:string):Promise<void>{
  await request('/'+encodeURIComponent(roomId)+'/close',{method:'POST',body:'{}'},token);
}
