export type AtomsMessage = {
  __atoms: true
  type: string
  [key: string]: unknown
}

export function isAtomsMessage(data: unknown): data is AtomsMessage {
  return Boolean(data && typeof data === 'object' && (data as AtomsMessage).__atoms)
}

export function postToIframe(frame: HTMLIFrameElement | null, payload: Record<string, unknown>) {
  frame?.contentWindow?.postMessage({ __atoms: true, ...payload }, '*')
}
