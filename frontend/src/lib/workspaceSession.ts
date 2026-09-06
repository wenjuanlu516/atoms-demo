import { getProject, postMessage, stopProject } from '@/lib/api'
import { attachStream } from '@/lib/stream'
import { planFromMessages } from '@/lib/types'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

/** Only reuse when this route is the project we just created and already painted. */
export function shouldReuseChat(
  currentId: number | null | undefined,
  routeId: number,
  busy: boolean,
  messageCount: number,
): boolean {
  return currentId === routeId && (busy || messageCount > 0)
}

function failSend(error: unknown) {
  useChatStore.setState({
    busy: false,
    awaitingApproval: false,
    pendingPlan: null,
    statusLabel: '',
    steps: [],
  })
  useChatStore.getState().applyEvent('error', {
    message: error instanceof Error ? error.message : '发送失败',
  })
}

export async function startNewProject(prompt: string, title?: string) {
  disconnectProjectStream()
  const chat = useChatStore.getState()
  if (!chat.busy) chat.beginRound('build', prompt)
  useChatStore.setState({ statusLabel: '正在创建项目…' })
  try {
    const project = await useProjectStore.getState().create(prompt, title)
    if (useChatStore.getState().busy) {
      useChatStore.setState({ statusLabel: '正在连接团队…' })
      connectProjectStream(project.id, true)
      void pullPlan(project.id)
    }
    return project
  } catch (error) {
    failSend(error)
    throw error
  }
}

export async function sendFollowUp(projectId: number, prompt: string) {
  const version = useProjectStore.getState().current?.current_version ?? 0
  const followUp = version > 0
  useChatStore.getState().beginRound(followUp ? 'iterate' : 'build', prompt)
  try {
    await postMessage(projectId, prompt)
    useProjectStore.getState().setStatus(followUp ? 'iterating' : 'generating')
    connectProjectStream(projectId, true)
    void pullPlan(projectId)
  } catch (error) {
    failSend(error)
    throw error
  }
}

export async function rewriteWaitingPlan(projectId: number | null) {
  const chat = useChatStore.getState()
  chat.bumpEpoch()
  if (projectId) {
    try {
      await stopProject(projectId)
    } catch {
      /* already idle */
    }
  }
  chat.markPlan('rejected')
}

export function stopLocally() {
  const chat = useChatStore.getState()
  chat.bumpEpoch()
  chat.setQueued(null)
  useChatStore.setState({
    busy: false,
    awaitingApproval: false,
    pendingPlan: null,
    statusLabel: '',
    steps: [],
  })
}

export async function stopGeneration(projectId: number) {
  stopLocally()
  try {
    await stopProject(projectId)
  } finally {
    useChatStore.getState().addSystemNote('已停止。可以改需求再发一条。')
    useProjectStore.getState().setStatus('idle')
  }
}

export function openBlankWorkspace() {
  useChatStore.getState().reset()
  usePreviewStore.getState().reset()
  useProjectStore.getState().clearCurrent()
}

export async function hydrateProject(id: number) {
  const detail = await getProject(id)
  await useProjectStore.getState().loadOne(id)
  const live = detail.status === 'generating' || detail.status === 'iterating'
  useChatStore.getState().hydrate(detail.messages, live)
  if (detail.current_version > 0) {
    usePreviewStore.getState().setUrl(`/preview/${id}/v${detail.current_version}/index.html`)
  }
  if (live) {
    const pending = planFromMessages(detail.messages)
    useChatStore.setState({
      busy: true,
      awaitingApproval: pending != null,
      pendingPlan: pending,
      statusLabel: pending ? '等待你接受计划' : '团队继续中…',
    })
    if (pending) useChatStore.getState().applyEvent('plan_ready', pending)
    else void pullPlan(id)
  }
  return live
}

let streamStop: (() => void) | null = null

export function disconnectProjectStream() {
  streamStop?.()
  streamStop = null
}

export function connectProjectStream(id: number, replay: boolean) {
  disconnectProjectStream()
  streamStop = attachStream(id, replay)
  return disconnectProjectStream
}

export async function pullPlan(id: number, attempts = 24, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    if (!useChatStore.getState().busy) return
    try {
      await syncGeneration(id)
    } catch {
      /* next attempt */
    }
    const chat = useChatStore.getState()
    if (
      chat.awaitingApproval ||
      chat.messages.some((item) => item.kind === 'plan' && item.planStatus === 'pending')
    ) {
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
  }
}

export function syncGeneration(id: number) {
  return getProject(id).then((detail) => {
    const chat = useChatStore.getState()
    if (!chat.busy) return
    const agents = detail.messages.filter((item) => item.role !== 'user')
    chat.ingestMessages(detail.messages)
    chat.syncStepsFromMessages(agents)
    const pending = planFromMessages(detail.messages)
    const waiting = chat.messages.some((item) => item.kind === 'plan' && item.planStatus === 'pending')
    if (pending && !waiting) {
      chat.applyEvent('plan_ready', pending)
    }
    if (detail.current_version > 0) {
      usePreviewStore.getState().setUrl(`/preview/${id}/v${detail.current_version}/index.html`)
    }
    if (detail.status !== 'idle' && detail.status !== 'published') return
    if (detail.current_version > 0) {
      void useProjectStore.getState().loadOne(id)
      useChatStore.setState({
        busy: false,
        awaitingApproval: false,
        statusLabel: '',
        steps: chat.steps.map((step) => ({ ...step, status: 'done' as const })),
      })
      useProjectStore.getState().setStatus(detail.status)
    } else if (!pending) {
      useChatStore.setState({ busy: false, statusLabel: '' })
      useProjectStore.getState().setStatus(detail.status)
    }
  })
}
