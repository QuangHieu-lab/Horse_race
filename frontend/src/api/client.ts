const API = '/api/v1';

export type UserRole =
  | 'horse_owner'
  | 'jockey'
  | 'referee'
  | 'spectator'
  | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? 'Request failed');
  }
  return json.data as T;
}

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function fetchMe() {
  return api<AuthUser>('/auth/me');
}

export async function fetchTournaments() {
  return api<unknown[]>('/tournaments');
}

export async function fetchRaces() {
  return api<unknown[]>('/races');
}

export async function publishResult(raceId: string) {
  return api<unknown>(`/results/race/${raceId}/publish`, { method: 'POST' });
}

export async function fetchMyPredictions() {
  return api<unknown[]>('/predictions/me');
}

export async function fetchNotifications() {
  return api<unknown[]>('/notifications');
}
