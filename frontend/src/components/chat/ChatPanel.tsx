import { useEffect, useRef, useState } from 'react'

import { AgentCard } from '@/components/chat/AgentCard'
import { ExampleCards } from '@/components/chat/ExampleCards'
import { MessageInput } from '@/components/chat/MessageInput'
import { ProgressTrack } from '@/components/chat/ProgressTrack'
import { approveProject } from '@/lib/api'
import { isStaticDemo } from '@/lib/staticMode'
import { useChatStore } from '@/stores/chatStore'
import { useProjectStore } from '@/stores/projectStore'

export function ChatPanel({
  onSend,
  onStop,
  busy,
}: {
  onSend: (text: string) => void
  onStop?: () => void
  busy: boolean
}) {
  const messages = useChatStore((state) => state.messages)
  const awaitingApproval = useChatStore((state) => state.awaitingApproval)
  const statusLabel = useChatStore((state) => state.statusLabel)
  const queued = useChatStore((state) => state.queued)
  const steps = useChatStore((state) => state.steps)
  const pastRounds = useChatStore((state) => state.pastRounds)
  const current = useProjectStore((state) => state.current)
  const [deciding, setDeciding] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const empty = messages.length === 0

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, awaitingApproval, steps, pastRounds])

  const decide = (approved: boolean) => {
    const project = current ?? useProjectStore.getState().current
    if (!project) {
      useChatStore.getState().applyEvent('error', { message: '项目还没就绪，请再点一次 Accept' })
      return
    }
    setDeciding(true)
    void approveProject(project.id, approved)
      .then(() => {
        useChatStore.getState().markPlan(approved ? 'accepted' : 'rejected')
        if (!approved) useProjectStore.getState().setStatus('idle')
      })
      .catch((error: unknown) => {
        useChatStore.getState().applyEvent('error', {
          message: error instanceof Error ? error.message : '操作失败',
        })
      })
      .finally(() => setDeciding(false))
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-line bg-panel">
      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
        {isStaticDemo() && (
          <p className="rounded-lg border border-line bg-raised px-3 py-2 text-[11px] leading-5 text-mist">
            GitHub Pages 静态演示：生成走内置回放，数据存在本机浏览器。完整管线请本地 <code className="text-fog">./start.sh</code>。
          </p>
        )}
        {empty && !busy && (
          <div className="px-0.5">
            <p className="text-sm font-medium text-snow">从一句话开始</p>
            <p className="mt-1 text-xs leading-5 text-mist">
              描述产品，Mike 会给出计划。接受后团队接力编码，过程会留在这条对话里。
            </p>
            <div className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-mist">建议试试</p>
              <ExampleCards onPick={onSend} />
            </div>
          </div>
        )}

        {messages.map((message) => (
          <AgentCard
            key={message.id}
            message={message}
            deciding={deciding}
            onAcceptPlan={() => decide(true)}
            onRejectPlan={() => decide(false)}
          />
        ))}
        {(busy || steps.some((step) => step.status !== 'pending') || pastRounds.length > 0) && (
          <ProgressTrack steps={steps} pastRounds={pastRounds} />
        )}
      </div>
      <MessageInput
        busy={busy}
        awaitingApproval={awaitingApproval}
        statusLabel={statusLabel}
        queued={queued}
        onSend={onSend}
        onStop={onStop}
        onQueue={(text) => useChatStore.getState().setQueued(text)}
        onClearQueue={() => useChatStore.getState().setQueued(null)}
        placeholder={
          empty ? '描述你想做的应用…' : awaitingApproval ? '接受计划，或改写需求后发送…' : '继续改一处，或提出下一轮需求…'
        }
      />
    </section>
  )
}
