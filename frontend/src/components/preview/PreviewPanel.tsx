import { useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@/components/preview/ErrorBar'
import { Button } from '@/components/ui/button'
import { reportFix } from '@/lib/api'
import { connectProjectStream } from '@/lib/workspaceSession'
import { isAtomsMessage, postToIframe } from '@/lib/postMessage'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function PreviewPanel({ onSend }: { onSend?: (text: string) => void }) {
  const url = usePreviewStore((state) => state.url)
  const viewport = usePreviewStore((state) => state.viewport)
  const setViewport = usePreviewStore((state) => state.setViewport)
  const ready = usePreviewStore((state) => state.ready)
  const error = usePreviewStore((state) => state.error)
  const setError = usePreviewStore((state) => state.setError)
  const current = useProjectStore((state) => state.current)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [fixing, setFixing] = useState(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isAtomsMessage(event.data)) return
      if (event.data.type === 'runtime_error') {
        const message = String(event.data.message ?? 'Runtime error')
        setError(message)
        if (current && !fixing) {
          setFixing(true)
          void reportFix(current.id, message, String(event.data.source ?? ''))
            .then((result) => {
              if (result.accepted) {
                useChatStore.getState().beginRound('iterate')
                connectProjectStream(current.id, true)
              }
            })
            .finally(() => setFixing(false))
        }
      }
      if (event.data.type === 'element_selected') {
        const label = `${event.data.tag} ${(event.data.text as string) || ''}`.trim()
        setPicked(label)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [current, fixing, setError])

  useEffect(() => {
    postToIframe(frameRef.current, { type: 'select_mode', enabled: selectMode })
  }, [selectMode, url])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-ink">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wider text-mist">Preview</p>
        <div className="flex gap-1">
          <Button
            variant={selectMode ? 'primary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setSelectMode((value) => !value)}
          >
            选择元素
          </Button>
          <Button
            variant={viewport === 'desktop' ? 'primary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setViewport('desktop')}
          >
            桌面
          </Button>
          <Button
            variant={viewport === 'mobile' ? 'primary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setViewport('mobile')}
          >
            移动
          </Button>
        </div>
      </div>
      {(error || fixing) && <ErrorBar message={error ?? ''} fixing={fixing} />}
      {picked && current && (
        <form
          className="flex gap-2 border-b border-line bg-raised px-3 py-2"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!instruction.trim()) return
            const text = `把这个元素改一下：${picked}。${instruction}`
            if (onSend) {
              onSend(text)
            } else {
              useChatStore.getState().addUserMessage(text)
            }
            setInstruction('')
            setPicked(null)
            setSelectMode(false)
          }}
        >
          <p className="max-w-[36%] truncate text-[11px] text-mist">{picked}</p>
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="对 AI 说：改成圆角大按钮…"
            className="flex-1 bg-transparent text-xs text-snow outline-none"
          />
          <Button type="submit" className="h-7 px-2 text-xs">
            发送
          </Button>
        </form>
      )}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#1a1f2c,transparent_55%)] p-4">
        {!url ? (
          <p className="m-auto max-w-xs text-center text-sm text-mist">生成完成后，应用会在这里即时运行。</p>
        ) : (
          <div
            className={cn(
              'relative min-h-0 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl',
              viewport === 'mobile' ? 'h-[min(640px,100%)] w-[375px]' : 'h-full w-full',
            )}
          >
            <iframe
              ref={frameRef}
              key={url}
              title="App Viewer"
              src={url}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-full w-full border-0 bg-white"
              onLoad={() => {
                usePreviewStore.getState().markReady()
                try {
                  frameRef.current?.contentWindow?.scrollTo(0, 0)
                } catch {
                  /* sandboxed */
                }
              }}
            />
            {ready && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-cyan/20 px-2 py-1 text-[10px] text-cyan">
                应用已就绪
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
