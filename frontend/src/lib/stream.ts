import { playMockGeneration, playMockIterate } from '@/lib/mockPlayback'
import { persistProjectSnapshot } from '@/lib/staticApi'
import { isStaticDemo } from '@/lib/staticMode'
import { connectSse } from '@/lib/sseClient'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function attachStream(id: number, replay = true) {
  if (isStaticDemo()) {
    const controller = new AbortController()
    const version = useProjectStore.getState().current?.current_version ?? 0
    const play = version < 1 ? playMockGeneration : playMockIterate
    void play(controller.signal)
      .then(() => {
        persistProjectSnapshot(id)
        useProjectStore.getState().setStatus('idle')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        useChatStore.getState().applyEvent('error', {
          message: error instanceof Error ? error.message : '演示回放失败',
        })
        useProjectStore.getState().setStatus('idle')
      })
    return () => controller.abort()
  }
  const epoch = useChatStore.getState().epoch
  const applyEvent = useChatStore.getState().applyEvent
  const applyFileWrite = useProjectStore.getState().applyFileWrite
  const setVersion = useProjectStore.getState().setVersion
  const setStatus = useProjectStore.getState().setStatus
  const loadOne = useProjectStore.getState().loadOne
  return connectSse(`/api/projects/${id}/stream`, {
    replay,
    onEvent: (event) => {
      if (
        (event.event === 'done' || event.event === 'error') &&
        useChatStore.getState().epoch !== epoch
      ) {
        return
      }
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
