import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button } from '@/components/ui/button'
import { AGENTS, isAgentRole } from '@/lib/agents'
import type { ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AgentCard({
  message,
  onAcceptPlan,
  onRejectPlan,
  deciding,
}: {
  message: ChatMessage
  onAcceptPlan?: () => void
  onRejectPlan?: () => void
  deciding?: boolean
}) {
  const [open, setOpen] = useState(!message.collapsed)

  if (message.role === 'user') {
    return (
      <div className="ml-10 rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-2.5 text-sm leading-6 text-snow">
        {message.content}
      </div>
    )
  }

  if (message.role === 'system') {
    return <p className="text-center text-xs text-mist">{message.content}</p>
  }

  if (message.kind === 'plan' && message.pendingPlan) {
    const pending = message.planStatus === 'pending'
    return (
      <article className="rounded-xl border border-accent/35 bg-accent/8 p-3">
        <p className="text-[13px] font-medium text-snow">
          {pending ? 'Review plan' : message.planStatus === 'accepted' ? 'Plan accepted' : 'Plan dismissed'}
        </p>
        <p className="mt-0.5 text-[11px] text-mist">
          {message.pendingPlan.change_level}
          {message.pendingPlan.dispatch.length > 0 ? ` · ${message.pendingPlan.dispatch.join(' · ')}` : ''}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] leading-6 text-fog">
          {message.pendingPlan.plan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {pending && (
          <div className="mt-3 flex gap-2">
            <Button disabled={deciding} onClick={onAcceptPlan}>
              Accept
            </Button>
            <Button variant="outline" disabled={deciding} onClick={onRejectPlan}>
              Reject
            </Button>
          </div>
        )}
      </article>
    )
  }

  const agent = isAgentRole(message.role) ? AGENTS[message.role] : null
  if (!agent) return null
  const expanded = message.streaming || open

  return (
    <article className="rounded-xl border border-line bg-raised/70">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-ink"
          style={{ background: agent.accent }}
        >
          {agent.initials}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-snow">
          {agent.name}
          <span className="ml-1.5 text-[11px] text-mist">{message.title || agent.title}</span>
        </span>
        {message.streaming ? (
          <span className="flex items-center gap-1 text-[11px] text-accent-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            running
          </span>
        ) : (
          <span className="text-[11px] text-mist">{expanded ? '收起' : '展开'}</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-line px-3 py-2.5">
          {message.content ? (
            <div className={cn('prose-atoms text-[13px] leading-6 text-fog', message.streaming && 'opacity-80')}>
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          ) : (
            <div className="flex gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mist" />
            </div>
          )}
        </div>
      )}
    </article>
  )
}
