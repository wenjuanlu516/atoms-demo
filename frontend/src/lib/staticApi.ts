import type { HealthResponse } from '@/lib/api'
import { isStaticDemo } from '@/lib/staticMode'
import type { FileEntry, Project, User } from '@/lib/types'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

const DB_KEY = 'atoms_static_db'
const TOKEN_PREFIX = 'static:'

type VersionSnap = {
  version: number
  summary: string | null
  created_at: string
  files: { path: string; content: string; size: number }[]
}

type StoredProject = {
  project: Project
  messages: { id: number; role: string; content: string; created_at: string }[]
  files: { path: string; content: string; size: number }[]
  versions: VersionSnap[]
  publishUrl?: string
}

type Db = {
  users: { id: number; username: string; password: string; created_at: string }[]
  nextUser: number
  nextProject: number
  nextMessage: number
  projects: Record<string, StoredProject>
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyDb(): Db {
  return { users: [], nextUser: 1, nextProject: 1, nextMessage: 1, projects: {} }
}

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...(JSON.parse(raw) as Db) }
  } catch {
    return emptyDb()
  }
}

function saveDb(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function userFromToken(): User | null {
  const token = localStorage.getItem('atoms_token')
  if (!token?.startsWith(TOKEN_PREFIX)) return null
  const id = Number(token.slice(TOKEN_PREFIX.length))
  const row = loadDb().users.find((item) => item.id === id)
  if (!row) return null
  return { id: row.id, username: row.username, created_at: row.created_at }
}

export function fetchHealth(): Promise<HealthResponse> {
  return Promise.resolve({
    ok: true,
    service: 'atoms-demo',
    env: 'static',
    llm_mock: true,
    llm_model: 'mock',
    model_choices: ['mock'],
  })
}

export function register(username: string, password: string) {
  const db = loadDb()
  if (db.users.some((item) => item.username === username)) {
    return Promise.reject(new Error('Username already taken'))
  }
  const user = { id: db.nextUser, username, password, created_at: nowIso() }
  db.nextUser += 1
  db.users.push(user)
  saveDb(db)
  return Promise.resolve({
    token: `${TOKEN_PREFIX}${user.id}`,
    user: { id: user.id, username: user.username, created_at: user.created_at },
  })
}

export function login(username: string, password: string) {
  const user = loadDb().users.find((item) => item.username === username && item.password === password)
  if (!user) return Promise.reject(new Error('Invalid username or password'))
  return Promise.resolve({
    token: `${TOKEN_PREFIX}${user.id}`,
    user: { id: user.id, username: user.username, created_at: user.created_at },
  })
}

export function fetchMe(): Promise<User> {
  const user = userFromToken()
  if (!user) return Promise.reject(new Error('Not authenticated'))
  return Promise.resolve(user)
}

export function listProjects(): Promise<Project[]> {
  const user = userFromToken()
  if (!user) return Promise.reject(new Error('Not authenticated'))
  const projects = Object.values(loadDb().projects)
    .filter((item) => item.project.title !== undefined)
    .map((item) => item.project)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return Promise.resolve(projects)
}

export function createProject(prompt: string, title?: string): Promise<Project> {
  const user = userFromToken()
  if (!user) return Promise.reject(new Error('Not authenticated'))
  const db = loadDb()
  const id = db.nextProject
  db.nextProject += 1
  const stamp = nowIso()
  const project: Project = {
    id,
    title: (title || prompt.trim().slice(0, 32) || 'Untitled').trim(),
    current_version: 0,
    status: 'generating',
    created_at: stamp,
    updated_at: stamp,
  }
  db.projects[String(id)] = {
    project,
    messages: [
      { id: db.nextMessage, role: 'user', content: prompt, created_at: stamp },
    ],
    files: [],
    versions: [],
  }
  db.nextMessage += 1
  saveDb(db)
  return Promise.resolve(project)
}

export function getProject(pid: number) {
  const row = loadDb().projects[String(pid)]
  if (!row) return Promise.reject(new Error('Project not found'))
  return Promise.resolve({
    ...row.project,
    files: row.files,
    messages: row.messages,
  })
}

export function deleteProject(pid: number): Promise<void> {
  const db = loadDb()
  delete db.projects[String(pid)]
  saveDb(db)
  return Promise.resolve()
}

export function postMessage(pid: number, content: string): Promise<Project> {
  const db = loadDb()
  const row = db.projects[String(pid)]
  if (!row) return Promise.reject(new Error('Project not found'))
  row.messages.push({
    id: db.nextMessage,
    role: 'user',
    content,
    created_at: nowIso(),
  })
  db.nextMessage += 1
  row.project.status = 'iterating'
  row.project.updated_at = nowIso()
  saveDb(db)
  return Promise.resolve(row.project)
}

export function approveProject(_pid: number, approved: boolean) {
  return Promise.resolve({ ok: true, approved })
}

export function stopProject(_pid: number): Promise<void> {
  return Promise.resolve()
}

export function listVersions(pid: number) {
  const row = loadDb().projects[String(pid)]
  if (!row) return Promise.reject(new Error('Project not found'))
  return Promise.resolve(
    [...row.versions]
      .sort((a, b) => b.version - a.version)
      .map((item) => ({ version: item.version, summary: item.summary, created_at: item.created_at })),
  )
}

export function getVersionFiles(pid: number, version: number) {
  const row = loadDb().projects[String(pid)]
  const snap = row?.versions.find((item) => item.version === version)
  if (!snap) return Promise.reject(new Error('Version not found'))
  return Promise.resolve(snap.files)
}

export function saveFile(pid: number, path: string, content: string) {
  const db = loadDb()
  const row = db.projects[String(pid)]
  if (!row) return Promise.reject(new Error('Project not found'))
  const files = row.files.map((file) =>
    file.path === path ? { ...file, content, size: content.length } : file,
  )
  if (!files.some((file) => file.path === path)) {
    files.push({ path, content, size: content.length })
  }
  const version = (row.project.current_version || 0) + 1
  row.files = files
  row.project.current_version = version
  row.project.updated_at = nowIso()
  row.versions.push({
    version,
    summary: `manual edit ${path}`,
    created_at: nowIso(),
    files: files.map((file) => ({ ...file })),
  })
  saveDb(db)
  return Promise.resolve({ version, path })
}

export function rollbackVersion(pid: number, version: number) {
  const db = loadDb()
  const row = db.projects[String(pid)]
  const snap = row?.versions.find((item) => item.version === version)
  if (!row || !snap) return Promise.reject(new Error('Version not found'))
  row.files = snap.files.map((file) => ({ ...file }))
  row.project.current_version = version
  row.project.updated_at = nowIso()
  saveDb(db)
  return Promise.resolve({ version })
}

export function publishProject(pid: number) {
  const db = loadDb()
  const row = db.projects[String(pid)]
  if (!row) return Promise.reject(new Error('Project not found'))
  const url = usePreviewStore.getState().url || window.location.href
  row.publishUrl = url
  saveDb(db)
  return Promise.resolve({ slug: `p${pid}`, url })
}

export function reportFix(_pid: number, _message: string, _source: string) {
  return Promise.resolve({ accepted: false })
}

export function persistProjectSnapshot(pid: number, summary = 'generation complete') {
  if (!isStaticDemo()) return
  const db = loadDb()
  const row = db.projects[String(pid)]
  if (!row) return
  const files = useProjectStore.getState().files.map((file) => ({
    path: file.path,
    content: file.content,
    size: file.size || file.content.length,
  }))
  const current = useProjectStore.getState().current
  const version = current?.current_version || 1
  row.files = files
  row.project.current_version = version
  row.project.status = 'idle'
  row.project.updated_at = nowIso()
  if (!row.versions.some((item) => item.version === version)) {
    row.versions.push({
      version,
      summary,
      created_at: nowIso(),
      files: files.map((file) => ({ ...file })),
    })
  }
  const chat = useChatStore.getState().messages
  row.messages = chat.map((item, index) => ({
    id: index + 1,
    role: item.role,
    content: item.content,
    created_at: nowIso(),
  }))
  saveDb(db)
}

export function filesForPreview(): FileEntry[] {
  return useProjectStore.getState().files
}
