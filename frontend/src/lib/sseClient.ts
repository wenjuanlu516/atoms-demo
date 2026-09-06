import { getToken } from './api'
import type { SseEvent } from './types'

type Handlers = {
  onEvent: (event: SseEvent) => void
  onError?: (error: unknown) => void
  replay?: boolean
}

export function parseBlock(block: string): SseEvent | null {
  let id = 0
  let event = 'message'
  const dataLines: string[] = []
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('id:')) id = Number(line.slice(3).trim())
    else if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (event === 'ping' || dataLines.length === 0) return null
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
  } catch {
    data = { raw: dataLines.join('\n') }
  }
  return { id, event, data }
}

export function connectSse(url: string, handlers: Handlers): () => void {
  const controller = new AbortController()
  let lastId = handlers.replay === false ? -1 : 0
  let attempt = 0
  let closed = false
  let timer: number | null = null
  const seen = new Set<number>()

  const open = async () => {
    if (closed) return
    const token = getToken()
    const joined = `${url}${url.includes('?') ? '&' : '?'}last_event_id=${lastId}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    try {
      const response = await fetch(joined, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(lastId ? { 'Last-Event-ID': String(lastId) } : {}),
        },
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`)
      }
      attempt = 0
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!closed) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const parsed = parseBlock(part)
          if (!parsed) continue
          if (parsed.id && seen.has(parsed.id)) continue
          if (parsed.id) {
            seen.add(parsed.id)
            lastId = parsed.id
          }
          handlers.onEvent(parsed)
        }
      }
    } catch (error) {
      if (closed || controller.signal.aborted) return
      handlers.onError?.(error)
    }
    if (closed) return
    const delay = Math.min(8000, 400 * 2 ** attempt)
    attempt += 1
    timer = window.setTimeout(() => {
      void open()
    }, delay)
  }

  void open()

  return () => {
    closed = true
    if (timer) window.clearTimeout(timer)
    controller.abort()
  }
}
