import type { AuthProfile, ConsultationSession, PlatformRole, TelemedicineRole } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  return body as T;
}

export async function issueDevToken(input: {
  userId: string;
  name: string;
  platformRole: PlatformRole;
}, testLoginKey = ''): Promise<AuthProfile> {
  const headers: Record<string, string> = {};
  // Never embed a server authentication secret into a public Vite bundle.
  const key = testLoginKey.trim();
  if (!key) throw new Error('기존 WebRTC 서버의 테스트 로그인 키를 입력해 주십시오.');
  headers['x-test-login-key'] = key;

  let result: {accessToken: string};
  try {
    result = await request<{ accessToken: string }>('/auth/dev-token', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof Error && /invalid test login key/i.test(error.message)) {
      throw new Error('테스트 로그인 키가 기존 서버 설정과 일치하지 않습니다. 실제 WEBRTC_TEST_LOGIN_KEY 값을 입력해 주십시오.');
    }
    throw error;
  }
  return { ...input, token: result.accessToken };
}

export async function getHealth() {
  return request<any>('/health');
}

export async function listMyConsultations(token: string): Promise<ConsultationSession[]> {
  return request<ConsultationSession[]>('/telemedicine/consultations/me', {}, token);
}

export async function getConsultation(token: string, id: string): Promise<ConsultationSession> {
  return request<ConsultationSession>(`/telemedicine/consultations/${encodeURIComponent(id)}`, {}, token);
}

export async function createConsultation(
  token: string,
  input: {
    title: string;
    scheduledAt?: string;
    maxParticipants?: number;
    participants: Array<{ userId: string; displayName?: string; role: TelemedicineRole }>;
  },
): Promise<ConsultationSession> {
  return request<ConsultationSession>('/telemedicine/consultations', {
    method: 'POST',
    body: JSON.stringify(input),
  }, token);
}
