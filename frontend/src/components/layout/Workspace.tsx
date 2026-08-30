import { ChatPanel } from '@/components/chat/ChatPanel'
import { CodePanel } from '@/components/code/CodePanel'
import { TopBar } from '@/components/layout/TopBar'
import { PreviewPanel } from '@/components/preview/PreviewPanel'

export function Workspace({
  onSend,
  onStop,
  busy,
}: {
  onSend: (text: string) => void
  onStop?: () => void
  busy: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_minmax(0,1fr)]">
        <ChatPanel onSend={onSend} onStop={onStop} busy={busy} />
        <CodePanel />
        <PreviewPanel />
      </div>
    </div>
  )
}
