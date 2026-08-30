import type { AgentRole } from './agents'

export type User = {
  id: number
  username: string
  created_at: string
}

export type Project = {
  id: number
  title: string
  current_version: number
  status: string
  created_at: string
  updated_at: string
}

export type ProjectFile = {
  path: string
  content?: string
  size: number
}

export function planFromMessages(messages: { role: string; content: string }[]): {
  plan: string[]
  change_level: string
  dispatch: string[]
} | null {
  const last = [...messages].reverse().find((item) => item.role !== 'user')
  if (last?.role !== 'mike' || !last.content.includes('执行计划')) return null
  const plan = [...last.content.matchAll(/^\d+\.\s+(.+)$/gm)].map((item) => item[1])
  const level = /变更级别：`?(\w+)/.exec(last.content)?.[1] ?? 'major'
  const dispatchMatch = /指派：(.+)/.exec(last.content)
  const dispatch = dispatchMatch ? dispatchMatch[1].split(/[、,，]/).map((item) => item.trim()).filter(Boolean) : []
  return { plan: plan.length ? plan : ['继续执行'], change_level: level, dispatch }
}

export type ChatMessage = {
  id: string
  role: AgentRole
  content: string
  title?: string
  streaming?: boolean
  collapsed?: boolean
  kind?: 'text' | 'plan'
  planStatus?: 'pending' | 'accepted' | 'rejected'
  pendingPlan?: {
    plan: string[]
    change_level: string
    dispatch: string[]
  }
  files?: string[]
  createdAt: number
}

export type SseEvent = {
  id: number
  event: string
  data: Record<string, unknown>
}

export type FileEntry = {
  path: string
  content: string
  size: number
  writing?: boolean
}
