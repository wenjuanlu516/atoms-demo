import { AGENTS } from '@/lib/agents'
import { cn } from '@/lib/utils'
import type { PastRound, ProgressStep } from '@/stores/chatStore'

function StepList({ steps, compact }: { steps: ProgressStep[]; compact?: boolean }) {
  return (
    <ol className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {steps.map((step) => {
        const agent = AGENTS[step.role]
        return (
          <li key={step.id} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                step.status === 'done' && 'bg-cyan/20 text-cyan',
                step.status === 'active' && 'bg-accent text-white',
                step.status === 'pending' && 'bg-line text-mist',
              )}
            >
              {step.status === 'done' ? '✓' : step.status === 'active' ? '·' : ''}
            </span>
            <span className={cn('min-w-0 flex-1', step.status === 'pending' ? 'text-mist' : 'text-snow')}>
              {step.label}
              <span className="ml-1.5 text-[11px] text-mist">{agent?.name}</span>
            </span>
            {step.status === 'active' && (
              <span className="flex items-center gap-1 text-[11px] text-accent-soft">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                进行中
              </span>
            )}
            {step.detail && step.status !== 'pending' && (
              <span className="max-w-[40%] truncate font-mono text-[10px] text-mist">{step.detail}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function ProgressTrack({
  steps,
  pastRounds = [],
}: {
  steps: ProgressStep[]
  pastRounds?: PastRound[]
}) {
  if (steps.length === 0 && pastRounds.length === 0) return null
  const active = steps.find((step) => step.status === 'active')
  const doneCount = steps.filter((step) => step.status === 'done').length

  return (
    <div className="space-y-2">
      {pastRounds.map((round) => (
        <article key={round.id} className="rounded-xl border border-line bg-raised/50 px-3 py-2">
          <p className="mb-1.5 text-[11px] text-mist">{round.title} · 已完成</p>
          <StepList steps={round.steps} compact />
        </article>
      ))}
      {steps.length > 0 && (
        <article className="rounded-xl border border-line bg-raised/80 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-snow">
              {pastRounds.length > 0 ? `第 ${pastRounds.length + 1} 轮` : '执行进度'}
            </p>
            <p className="text-[11px] text-mist">
              {doneCount}/{steps.length}
              {active ? ` · ${active.label}` : ''}
            </p>
          </div>
          <StepList steps={steps} />
        </article>
      )}
    </div>
  )
}
