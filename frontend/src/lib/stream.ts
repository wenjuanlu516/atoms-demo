import { connectSse } from '@/lib/sseClient'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function attachStream(id: number, replay = true) {
  const applyEvent = useChatStore.getState().applyEvent
  const applyFileWrite = useProjectStore.getState().applyFileWrite
  const setVersion = useProjectStore.getState().setVersion
  const setStatus = useProjectStore.getState().setStatus
  const loadOne = useProjectStore.getState().loadOne
  return connectSse(`/api/projects/${id}/stream`, {
    replay,
    onEvent: (event) => {
      applyEvent(event.event, event.data)
      if (event.event === 'file_write') {
        applyFileWrite(
          String(event.data.path),
          String(event.data.content ?? ''),
          String(event.data.action ?? 'create'),
        )
      }
      if (event.event === 'version') {
        const version = Number(event.data.version ?? 1)
        setVersion(version)
        usePreviewStore.getState().setUrl(`/preview/${id}/v${version}/index.html`)
        void loadOne(id)
      }
      if (event.event === 'done' || event.event === 'error') setStatus('idle')
    },
  })
}
