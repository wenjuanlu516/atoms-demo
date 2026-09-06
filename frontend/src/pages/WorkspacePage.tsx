import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Workspace } from '@/components/layout/Workspace'
import {
  connectProjectStream,
  hydrateProject,
  openBlankWorkspace,
  pullPlan,
  rewriteWaitingPlan,
  sendFollowUp,
  shouldReuseChat,
  startNewProject,
  stopGeneration,
  stopLocally,
  syncGeneration,
} from '@/lib/workspaceSession'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function WorkspacePage() {
  const { pid } = useParams()
  if (!pid || pid === 'new') return <BlankWorkspace />
  const id = Number(pid)
  if (!Number.isFinite(id) || id < 1) return <Navigate to="/w/new" replace />
  return <ProjectWorkspace key={id} id={id} />
}

function useLiveSync(projectId: number | null, busy: boolean) {
  useEffect(() => {
    if (!projectId || !busy) return
    const tick = () => {
      void syncGeneration(projectId)
    }
    tick()
    const timer = window.setInterval(tick, 1200)
    return () => window.clearInterval(timer)
  }, [projectId, busy])
}

function BlankWorkspace() {
  const navigate = useNavigate()
  const busy = useChatStore((state) => state.busy)
  const queued = useChatStore((state) => state.queued)
  const currentId = useProjectStore((state) => state.current?.id ?? null)

  useEffect(() => {
    const chat = useChatStore.getState()
    if (chat.busy || chat.messages.length > 0) return
    openBlankWorkspace()
  }, [])

  useLiveSync(currentId, busy)

  const onSend = async (text: string) => {
    const chat = useChatStore.getState()
    const existing = useProjectStore.getState().current?.id
    if (chat.awaitingApproval) {
      await rewriteWaitingPlan(existing ?? null)
    } else if (chat.busy && existing) {
      chat.setQueued(text)
      return
    } else if (chat.busy) {
      stopLocally()
    }
    try {
      const currentId = useProjectStore.getState().current?.id
      if (currentId) {
        await sendFollowUp(currentId, text)
        if (useChatStore.getState().busy) {
          navigate(`/w/${currentId}`, { replace: true, state: { handoff: true } })
        }
        return
      }
      const project = await startNewProject(text)
      if (!useChatStore.getState().busy) {
        void stopGeneration(project.id)
        return
      }
      navigate(`/w/${project.id}`, { replace: true, state: { handoff: true } })
    } catch {
      /* session helpers record the error */
    }
  }

  useEffect(() => {
    if (busy || !queued) return
    const text = queued
    useChatStore.getState().setQueued(null)
    void onSend(text)
  }, [busy, queued])

  const onStop = () => {
    const projectId = useProjectStore.getState().current?.id
    if (projectId) void stopGeneration(projectId)
    else stopLocally()
  }

  return <Workspace onSend={onSend} onStop={onStop} busy={busy} />
}

function ProjectWorkspace({ id }: { id: number }) {
  const location = useLocation()
  const handoff = useRef((location.state as { handoff?: boolean } | null)?.handoff === true)
  const busy = useChatStore((state) => state.busy)
  const queued = useChatStore((state) => state.queued)

  useEffect(() => {
    const reuse =
      handoff.current &&
      shouldReuseChat(
        useProjectStore.getState().current?.id,
        id,
        useChatStore.getState().busy,
        useChatStore.getState().messages.length,
      )
    handoff.current = false
    if (reuse) {
      void useProjectStore.getState().loadOne(id)
      void pullPlan(id)
      return connectProjectStream(id, true)
    }

    let cancelled = false
    let disconnect: (() => void) | null = null
    useChatStore.getState().reset()
    usePreviewStore.getState().reset()
    void hydrateProject(id)
      .then((live) => {
        if (!cancelled) disconnect = connectProjectStream(id, live)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        useChatStore.getState().applyEvent('error', {
          message: error instanceof Error ? error.message : '项目加载失败',
        })
      })
    return () => {
      cancelled = true
      disconnect?.()
    }
  }, [id])

  useLiveSync(id, busy)

  const onSend = async (text: string) => {
    const chat = useChatStore.getState()
    if (chat.awaitingApproval) {
      await rewriteWaitingPlan(id)
    } else if (chat.busy) {
      chat.setQueued(text)
      return
    }
    await sendFollowUp(id, text)
  }

  useEffect(() => {
    if (busy || !queued) return
    const text = queued
    useChatStore.getState().setQueued(null)
    void onSend(text)
  }, [busy, queued, id])

  return (
    <Workspace
      onSend={onSend}
      onStop={() => void stopGeneration(id)}
      busy={busy}
    />
  )
}
