import { type FormEvent, useEffect, useRef, useState } from 'react'

import { ModelSelect } from '@/components/layout/ModelSelect'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MessageInput({
  busy,
  awaitingApproval,
  statusLabel,
  queued,
  onSend,
  onStop,
  onQueue,
  onClearQueue,
  placeholder,
}: {
  busy?: boolean
  awaitingApproval?: boolean
  statusLabel?: string
  queued?: string | null
  onSend: (text: string) => void
  onStop?: () => void
  onQueue?: (text: string) => void
  onClearQueue?: () => void
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    areaRef.current?.focus()
  }, [])

  useEffect(() => {
    const node = areaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`
  }, [value])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const text = value.trim()
    if (!text) return
    if (busy && !awaitingApproval && onQueue) {
      onQueue(text)
      setValue('')
      requestAnimationFrame(() => areaRef.current?.focus())
      return
    }
    if (busy) return
    onSend(text)
    setValue('')
    requestAnimationFrame(() => areaRef.current?.focus())
  }

  const hint = awaitingApproval
    ? '接受计划后团队继续；也可以先改需求再发送'
    : busy
      ? '工作中可输入下一条，发送后会排队'
      : 'Enter 发送 · Shift+Enter 换行'

  return (
    <form onSubmit={submit} className="border-t border-line bg-panel p-3">
      {queued && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[11px] text-fog">
          <span className="truncate">排队：{queued}</span>
          <button type="button" className="text-mist hover:text-snow" onClick={onClearQueue}>
            取消
          </button>
        </div>
      )}
      <div
        className={cn(
          'rounded-xl border bg-raised p-2 transition',
          busy ? 'border-accent/30' : 'border-line focus-within:border-accent/50',
        )}
      >
        <textarea
          ref={areaRef}
          value={value}
          rows={2}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="max-h-40 w-full resize-none bg-transparent text-sm leading-6 text-snow outline-none placeholder:text-mist"
        />
        {statusLabel && (
          <p className="mb-1.5 px-0.5 text-[11px] text-accent-soft">{statusLabel}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex flex-1 items-center gap-2">
            <ModelSelect compact />
            {!statusLabel && <p className="min-w-0 truncate text-[11px] text-mist">{hint}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {busy && onStop && (
              <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={onStop}>
                停止
              </Button>
            )}
            <Button
              type="submit"
              className="h-8 px-3 text-xs"
              disabled={!value.trim() || (busy && awaitingApproval)}
            >
              {busy && !awaitingApproval ? '排队' : '发送'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
