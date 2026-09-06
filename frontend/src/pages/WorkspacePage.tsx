import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Workspace } from '@/components/layout/Workspace'
import { getProject, postMessage, stopProject } from '@/lib/api'
import { planFromMessages } from '@/lib/types'
import { attachStream } from '@/lib/stream'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function WorkspacePage() {
  const { pid } = useParams()
  const navigate = useNavigate()
  const busy = useChatStore((state) => state.busy)
  const queued = useChatStore((state) => state.queued)
  const addUserMessage = useChatStore((state) => state.addUserMessage)
  const hydrateChat = useChatStore((state) => state.hydrate)
  const resetChat = useChatStore((state) => state.reset)
  const create = useProjectStore((state) => state.create)
  const loadOne = useProjectStore((state) => state.loadOne)
  const setStatus = useProjectStore((state) => state.setStatus)
  const clearCurrent = useProjectStore((state) => state.clearCurrent)
  const currentId = useProjectStore((state) => state.current?.id)
  const resetPreview = usePreviewStore((state) => state.reset)
  const disconnectRef = useRef<(() => void) | null>(null)
  const keepChatForRef = useRef<number | null>(null)
  const sendingRef = useRef(false)
  const bootRef = useRef(0)

  useEffect(() => {
    const boot = ++bootRef.current
    const keepId = keepChatForRef.current ?? useProjectStore.getState().keepChatId
    if (pid && pid !== 'new' && keepId === Number(pid)) {
      const id = Number(pid)
      void loadOne(id)
      disconnectRef.current?.()
      disconnectRef.current = attachStream(id, true)
      return () => {
        if (bootRef.current === boot) disconnectRef.current?.()
      }
    }
    if (keepId != null && pid && keepId !== Number(pid) && pid !== 'new') {
      useProjectStore.getState().setKeepChatId(null)
      keepChatForRef.current = null
    }

    if (sendingRef.current && (!pid || pid === 'new')) {
      return
    }

    resetChat()
    resetPreview()
    disconnectRef.current?.()
    disconnectRef.current = null
    if (!pid || pid === 'new') {
      clearCurrent()
      return
    }
    const id = Number(pid)
    void (async () => {
      await loadOne(id)
      const detail = await getProject(id)
      if (bootRef.current !== boot) return
      const live = detail.status === 'generating' || detail.status === 'iterating'
      hydrateChat(detail.messages, live)
      if (detail.current_version > 0) {
        usePreviewStore.getState().setUrl(`/preview/${id}/v${detail.current_version}/index.html`)
      }
      const hasAgents = detail.messages.some((item) => item.role !== 'user' && item.role !== 'system')
      disconnectRef.current = attachStream(id, live && !hasAgents)
      if (live) {
        const pending = planFromMessages(detail.messages)
        useChatStore.setState({
          busy: true,
          awaitingApproval: pending != null,
          pendingPlan: pending,
          statusLabel: pending ? '等待你接受计划' : '团队继续中…',
        })
        if (pending) {
          useChatStore.getState().applyEvent('plan_ready', pending)
        }
      }
    })()
    return () => {
      if (bootRef.current === boot) disconnectRef.current?.()
    }
  }, [pid, loadOne, clearCurrent, resetChat, resetPreview, hydrateChat])

  const sendNow = async (text: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    const followUp = Boolean(
      useProjectStore.getState().current?.current_version ||
        useChatStore.getState().messages.some((item) => item.role !== 'user' && item.role !== 'system'),
    )
    useChatStore.getState().beginRound(followUp ? 'iterate' : 'build')
    addUserMessage(text)
    try {
      if (!pid || pid === 'new') {
        useChatStore.setState({ statusLabel: '正在创建项目…' })
        const project = await create(text)
        keepChatForRef.current = project.id
        useProjectStore.getState().setKeepChatId(project.id)
        disconnectRef.current?.()
        disconnectRef.current = attachStream(project.id, true)
        useChatStore.setState({ statusLabel: '等待你接受计划' })
        navigate(`/w/${project.id}`, { replace: true })
        return
      }
      const id = Number(pid)
      await postMessage(id, text)
      setStatus('iterating')
      disconnectRef.current?.()
      disconnectRef.current = attachStream(id, true)
    } catch (error) {
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
    } finally {
      sendingRef.current = false
    }
  }

  const onSend = async (text: string) => {
    if (busy) {
      useChatStore.getState().setQueued(text)
      return
    }
    await sendNow(text)
  }

  useEffect(() => {
    if (!busy) return
    const id = pid && pid !== 'new' ? Number(pid) : currentId
    if (!id) return
    const tick = () => {
      void getProject(id).then((detail) => {
        const chat = useChatStore.getState()
        if (!chat.busy) return
        const agents = detail.messages.filter((item) => item.role !== 'user')
        chat.ingestMessages(detail.messages)
        chat.syncStepsFromMessages(agents)
        const pending = planFromMessages(detail.messages)
        if (pending && !chat.awaitingApproval && !chat.messages.some((item) => item.kind === 'plan')) {
          chat.applyEvent('plan_ready', pending)
        }
        if (detail.current_version > 0 && !usePreviewStore.getState().url) {
          usePreviewStore.getState().setUrl(`/preview/${id}/v${detail.current_version}/index.html`)
        }
        if (detail.status === 'idle' || detail.status === 'published') {
          if (detail.current_version > 0) {
            usePreviewStore.getState().setUrl(`/preview/${id}/v${detail.current_version}/index.html`)
            void loadOne(id)
          }
          if (agents.some((item) => item.role === 'qa' || item.role === 'alex')) {
            useChatStore.setState({ busy: false, statusLabel: '', steps: chat.steps.map((step) => ({ ...step, status: 'done' })) })
            setStatus(detail.status)
          }
        }
      })
    }
    tick()
    const timer = window.setInterval(tick, 1200)
    return () => window.clearInterval(timer)
  }, [busy, pid, currentId, loadOne, setStatus])

  useEffect(() => {
    if (busy || !queued || sendingRef.current) return
    const text = queued
    useChatStore.getState().setQueued(null)
    void sendNow(text)
  }, [busy, queued])

  const onStop = async () => {
    useChatStore.getState().setQueued(null)
    if (!pid || pid === 'new') {
      sendingRef.current = false
      useChatStore.setState({
        busy: false,
        awaitingApproval: false,
        pendingPlan: null,
        statusLabel: '',
        steps: [],
      })
      return
    }
    try {
      await stopProject(Number(pid))
    } finally {
      useChatStore.setState({ busy: false, awaitingApproval: false, pendingPlan: null, statusLabel: '' })
      setStatus('idle')
    }
  }

  return <Workspace onSend={onSend} onStop={onStop} busy={busy} />
}
