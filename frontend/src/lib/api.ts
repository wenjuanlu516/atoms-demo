import type { Project, User } from './types'

const TOKEN_KEY = 'atoms_token'
export const MODEL_KEY = 'atoms_model'

export type HealthResponse = {
  ok: boolean
  service: string
  env: string
  llm_mock: boolean
  llm_model: string
  model_choices: string[]
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getPreferredModel(): string {
  return localStorage.getItem(MODEL_KEY) ?? ''
}

export function setPreferredModel(model: string): void {
  if (model) localStorage.setItem(MODEL_KEY, model)
  else localStorage.removeItem(MODEL_KEY)
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    if (typeof body.detail === 'string') return body.detail
  } catch {
    /* ignore */
  }
  return `Request failed: ${response.status}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const tokenHeaders = authHeaders()
  if ('Authorization' in tokenHeaders) {
    headers.set('Authorization', tokenHeaders.Authorization as string)
  }
  const response = await fetch(path, { ...init, headers })
  if (response.status === 204) return undefined as T
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<T>
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request('/api/health')
}

export async function register(username: string, password: string) {
  return request<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchMe(): Promise<User> {
  return request('/api/auth/me')
}

export async function listProjects(): Promise<Project[]> {
  return request('/api/projects')
}

export async function createProject(prompt: string, title?: string, model?: string): Promise<Project> {
  return request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ prompt, title, model: model || getPreferredModel() || undefined }),
  })
}

export async function getProject(pid: number) {
  return request<
    Project & {
      files: { path: string; size: number; content?: string }[]
      messages: { id: number; role: string; content: string; created_at: string }[]
    }
  >(`/api/projects/${pid}`)
}

export async function deleteProject(pid: number): Promise<void> {
  await request(`/api/projects/${pid}`, { method: 'DELETE' })
}

export async function postMessage(pid: number, content: string, model?: string): Promise<Project> {
  return request(`/api/projects/${pid}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, model: model || getPreferredModel() || undefined }),
  })
}

export async function approveProject(pid: number, approved: boolean): Promise<{ ok: boolean; approved: boolean }> {
  return request(`/api/projects/${pid}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved }),
  })
}

export async function stopProject(pid: number): Promise<void> {
  await request(`/api/projects/${pid}/stop`, { method: 'POST' })
}

export async function listVersions(pid: number) {
  return request<{ version: number; summary: string | null; created_at: string }[]>(
    `/api/projects/${pid}/versions`,
  )
}

export async function getVersionFiles(pid: number, version: number) {
  return request<{ path: string; content: string; size: number }[]>(
    `/api/projects/${pid}/versions/${version}/files`,
  )
}

export async function saveFile(pid: number, path: string, content: string) {
  return request<{ version: number; path: string }>(`/api/projects/${pid}/files/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export async function rollbackVersion(pid: number, version: number) {
  return request<{ version: number }>(`/api/projects/${pid}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
}

export async function publishProject(pid: number) {
  return request<{ slug: string; url: string }>(`/api/projects/${pid}/publish`, { method: 'POST' })
}

export async function reportFix(pid: number, message: string, source: string) {
  return request<{ accepted: boolean }>(`/api/projects/${pid}/fix`, {
    method: 'POST',
    body: JSON.stringify({ message, source, model: getPreferredModel() || undefined }),
  })
}
