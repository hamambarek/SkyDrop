// Thin client for the SkyDrop account/save API.
// Base URL: same origin in dev (vite proxies /api) and in production behind
// a reverse proxy; override with VITE_API_URL for a separately-hosted API.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export interface AuthResponse {
  token: string
  username: string
}

export interface LeaderboardRow {
  username: string
  xp: number
  deliveries: number
  credits_earned: number
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status)
  return body as T
}

export const api = {
  register: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getSave: (token: string) =>
    request<{ save: Record<string, unknown> | null; updatedAt?: string }>('/api/save', {}, token),
  putSave: (token: string, save: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/save', { method: 'PUT', body: JSON.stringify({ save }) }, token),
  leaderboard: () => request<{ leaderboard: LeaderboardRow[] }>('/api/leaderboard'),
  startTrialRun: (token: string, trialId: string) =>
    request<{ nonce: string }>('/api/trials/start', { method: 'POST', body: JSON.stringify({ trialId }) }, token),
  submitTrial: (token: string, trialId: string, ms: number, trace: number[][], nonce: string | null) =>
    request<{ best: number; rank: number | null; total: number; flagged: boolean }>(
      '/api/trials',
      { method: 'POST', body: JSON.stringify({ trialId, ms, trace, nonce }) },
      token
    ),
  trialSummary: (token?: string | null) =>
    request<{ boards: Record<string, { username: string; ms: number }[]>; mine: Record<string, number> | null }>(
      '/api/trials/summary',
      {},
      token
    ),
}

export { ApiError }
