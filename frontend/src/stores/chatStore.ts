import { create } from 'zustand'

import type { AgentRole } from '@/lib/agents'
import { AGENTS, isAgentRole } from '@/lib/agents'
import type { ChatMessage } from '@/lib/types'

export type PendingPlan = {
  plan: string[]
  change_level: string
  dispatch: string[]
}

export type ProgressStep = {
  id: string
  label: string
  role: 'emma' | 'bob' | 'alex' | 'qa'
  status: 'pending' | 'active' | 'done'
  detail?: string
}

export type PastRound = {
  id: string
  title: string
  steps: ProgressStep[]
}

const ROLE_STEP: Record<string, string> = {
  emma: 'emma',
  bob: 'bob',
  alex: 'alex',
  qa: 'qa',
}

export function stepsFromPlan(plan: PendingPlan | null): ProgressStep[] {
  const labels = plan?.plan?.length
    ? plan.plan
    : ['PRD', '架构设计', '编码', '验证']
  const roles: ProgressStep['role'][] = ['emma', 'bob', 'alex', 'qa']
  return labels.slice(0, 4).map((label, index) => ({
    id: roles[index] ?? `step-${index}`,
    label,
    role: roles[index] ?? 'alex',
    status: 'pending',
  }))
}

const ROLE_ORDER: ProgressStep['role'][] = ['emma', 'bob', 'alex', 'qa']

export function iterateSteps(): ProgressStep[] {
  return [
    { id: 'emma', label: '理解改动', role: 'emma', status: 'pending' },
    { id: 'bob', label: '调整方案', role: 'bob', status: 'pending' },
    { id: 'alex', label: '改代码', role: 'alex', status: 'pending' },
    { id: 'qa', label: '验证', role: 'qa', status: 'pending' },
  ]
}

function touchStep(steps: ProgressStep[], role: string, status: ProgressStep['status'], detail?: string): ProgressStep[] {
  const key = ROLE_STEP[role]
  if (!key) return steps
  const target = ROLE_ORDER.indexOf(key as ProgressStep['role'])
  return steps.map((step) => {
    const index = ROLE_ORDER.indexOf(step.role)
    if (status === 'active' && index >= 0 && index < target && step.status !== 'done') {
      return { ...step, status: 'done' }
    }
    if (step.role !== key) {
      if (status === 'active' && step.status === 'active') return { ...step, status: 'done' }
      return step
    }
    return { ...step, status, detail: detail ?? step.detail }
  })
}

type ChatState = {
  messages: ChatMessage[]
  activeRole: AgentRole | null
  busy: boolean
  awaitingApproval: boolean
  pendingPlan: PendingPlan | null
  queued: string | null
  statusLabel: string
  steps: ProgressStep[]
  pastRounds: PastRound[]
  stats: { tokens: number; duration: number } | null
  reset: () => void
  addUserMessage: (content: string) => void
  beginRound: (kind: 'build' | 'iterate') => void
  addSystemNote: (content: string) => void
  hydrate: (items: { role: string; content: string }[], keepBusy?: boolean) => void
  applyEvent: (event: string, data: Record<string, unknown>) => void
  clearApproval: () => void
  markPlan: (status: 'accepted' | 'rejected') => void
  setQueued: (text: string | null) => void
  syncStepsFromMessages: (items: { role: string; content: string }[]) => void
}

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function statusFor(role: string, title: string): string {
  if (isAgentRole(role)) return `${AGENTS[role].name} · ${title || AGENTS[role].blurb}`
  return title || '团队工作中'
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  activeRole: null,
  busy: false,
  awaitingApproval: false,
  pendingPlan: null,
  queued: null,
  statusLabel: '',
  steps: [],
  pastRounds: [],
  stats: null,
  reset: () =>
    set({
      messages: [],
      activeRole: null,
      busy: false,
      awaitingApproval: false,
      pendingPlan: null,
      queued: null,
      statusLabel: '',
      steps: [],
      pastRounds: [],
      stats: null,
    }),
  hydrate: (items, keepBusy = false) =>
    set((state) => {
      const hasTeam = items.some((item) => item.role !== 'user' && item.role !== 'system')
      return {
        messages: items.map((item) => ({
          id: nextId(item.role),
          role: item.role as ChatMessage['role'],
          content: item.content,
          createdAt: Date.now(),
        })),
        busy: keepBusy,
        activeRole: null,
        pastRounds:
          !keepBusy && hasTeam
            ? [
                {
                  id: 'round-loaded',
                  title: '已完成的生成',
                  steps: stepsFromPlan(null).map((step) => ({ ...step, status: 'done' as const })),
                },
              ]
            : [],
        steps: keepBusy ? state.steps : [],
        statusLabel: keepBusy ? '团队继续中…' : '',
      }
    }),
  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: nextId('user'), role: 'user', content, createdAt: Date.now() },
      ],
    })),
  addSystemNote: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: nextId('sys'), role: 'system', content, createdAt: Date.now() },
      ],
    })),
  beginRound: (kind) =>
    set((state) => {
      const shouldArchive = state.steps.some((step) => step.status !== 'pending')
      const archived = shouldArchive
        ? [
            ...state.pastRounds,
            {
              id: nextId('round'),
              title: state.pastRounds.length === 0 ? '首次生成' : `第 ${state.pastRounds.length + 1} 轮`,
              steps: state.steps.map((step) => ({ ...step, status: 'done' as const })),
            },
          ]
        : state.pastRounds
      const steps = kind === 'iterate' ? iterateSteps() : stepsFromPlan(state.pendingPlan)
      const note =
        kind === 'iterate'
          ? {
              id: nextId('sys'),
              role: 'system' as const,
              content: `${archived.length === 0 ? '第 1 轮' : `第 ${archived.length + 1} 轮`} · 迭代开始`,
              createdAt: Date.now(),
            }
          : null
      return {
        pastRounds: archived,
        steps,
        busy: true,
        awaitingApproval: false,
        statusLabel: kind === 'iterate' ? '已收到改动，正在安排…' : '已发送，正在连接团队…',
        messages: note ? [...state.messages, note] : state.messages,
      }
    }),
  clearApproval: () => set({ awaitingApproval: false, pendingPlan: null }),
  markPlan: (status) =>
    set((state) => {
      const steps =
        status === 'accepted'
          ? touchStep(state.steps.length ? state.steps : stepsFromPlan(state.pendingPlan), 'emma', 'active')
          : []
      return {
        awaitingApproval: false,
        pendingPlan: status === 'accepted' ? state.pendingPlan : null,
        messages: state.messages.map((item) =>
          item.kind === 'plan' && item.planStatus === 'pending' ? { ...item, planStatus: status } : item,
        ),
        statusLabel: status === 'accepted' ? 'Emma · 撰写 PRD' : '',
        busy: status === 'accepted',
        steps,
      }
    }),
  setQueued: (text) => set({ queued: text }),
  syncStepsFromMessages: (items) =>
    set((state) => {
      const seen = new Set(items.map((item) => item.role))
      const base = state.steps.length ? state.steps : stepsFromPlan(state.pendingPlan)
      const steps = base.map((step) => {
        if (seen.has(step.role)) return { ...step, status: 'done' as const }
        return { ...step, status: 'pending' as const }
      })
      if (!state.busy) return { steps }
      const nextIndex = steps.findIndex((step) => step.status === 'pending')
      if (nextIndex < 0) return { steps }
      return {
        steps: steps.map((step, index) =>
          index === nextIndex ? { ...step, status: 'active' as const } : step,
        ),
      }
    }),
  applyEvent: (event, data) =>
    set((state) => {
      if (event === 'agent_start') {
        const role = String(data.role) as AgentRole
        const title = String(data.title ?? '')
        const messages = state.messages.map((item) =>
          item.streaming && item.kind !== 'plan' ? { ...item, streaming: false, collapsed: true } : item,
        )
        return {
          busy: true,
          activeRole: role,
          awaitingApproval: false,
          statusLabel: statusFor(role, title),
          steps: touchStep(state.steps.length ? state.steps : stepsFromPlan(state.pendingPlan), role, 'active'),
          messages: [
            ...messages,
            {
              id: nextId(role),
              role,
              title,
              content: '',
              streaming: true,
              createdAt: Date.now(),
            },
          ],
        }
      }
      if (event === 'agent_message') {
        const role = String(data.role) as ChatMessage['role']
        const content = String(data.content_md ?? '')
        let updated = false
        const messages = state.messages.map((item) => {
          if (!updated && item.role === role && item.streaming && item.kind !== 'plan') {
            updated = true
            return { ...item, content, streaming: false }
          }
          return item
        })
        if (!updated) {
          messages.push({ id: nextId(role), role, content, createdAt: Date.now() })
        }
        return {
          messages,
          steps: touchStep(state.steps.length ? state.steps : stepsFromPlan(state.pendingPlan), role, 'done'),
        }
      }
      if (event === 'file_write') {
        const path = String(data.path ?? '')
        const messages = state.messages.map((item) => {
          if (item.role !== 'alex' || !item.streaming) return item
          const files = item.files?.includes(path) ? item.files : [...(item.files ?? []), path]
          return { ...item, files, content: files.map((file) => `- \`${file}\``).join('\n') }
        })
        return {
          messages,
          statusLabel: `Alex · 写入 ${path}`,
          steps: touchStep(state.steps.length ? state.steps : stepsFromPlan(state.pendingPlan), 'alex', 'active', path),
        }
      }
      if (event === 'plan_ready') {
        const plan = Array.isArray(data.plan) ? data.plan.map(String) : []
        const dispatch = Array.isArray(data.dispatch) ? data.dispatch.map(String) : []
        const pendingPlan = {
          plan,
          change_level: String(data.change_level ?? 'major'),
          dispatch,
        }
        const accepted = state.messages.some((item) => item.kind === 'plan' && item.planStatus === 'accepted')
        if (accepted) return state
        const exists = state.messages.some((item) => item.kind === 'plan' && item.planStatus === 'pending')
        return {
          busy: true,
          awaitingApproval: true,
          pendingPlan,
          statusLabel: '等待你接受计划',
          steps: stepsFromPlan(pendingPlan),
          messages: exists
            ? state.messages
            : [
                ...state.messages,
                {
                  id: nextId('plan'),
                  role: 'mike',
                  kind: 'plan',
                  planStatus: 'pending',
                  pendingPlan,
                  content: '',
                  title: '执行计划',
                  createdAt: Date.now(),
                },
              ],
        }
      }
      if (event === 'validation') {
        const passed = Boolean(data.passed)
        const issues = Array.isArray(data.issues) ? data.issues : []
        const content = passed
          ? '静态检查通过，未发现 blocker。'
          : `发现 ${issues.length} 个问题，准备回传修复。`
        return {
          statusLabel: passed ? 'QA · 验证通过' : 'QA · 发现问题',
          messages: [
            ...state.messages.map((item) => (item.streaming ? { ...item, streaming: false } : item)),
            { id: nextId('qa'), role: 'qa', title: '验证报告', content, createdAt: Date.now() },
          ],
        }
      }
      if (event === 'done') {
        const stats = (data.stats as { tokens?: number; duration?: number } | undefined) ?? {}
        return {
          busy: false,
          activeRole: null,
          awaitingApproval: false,
          statusLabel: '',
          steps: state.steps.map((step) => ({ ...step, status: 'done' as const })),
          stats: { tokens: stats.tokens ?? 0, duration: stats.duration ?? 0 },
          messages: state.messages.map((item) => (item.streaming ? { ...item, streaming: false } : item)),
        }
      }
      if (event === 'error') {
        return {
          busy: false,
          awaitingApproval: false,
          pendingPlan: null,
          statusLabel: '',
          messages: [
            ...state.messages,
            {
              id: nextId('sys'),
              role: 'system',
              content: String(data.message ?? '生成失败'),
              createdAt: Date.now(),
            },
          ],
        }
      }
      return state
    }),
}))
