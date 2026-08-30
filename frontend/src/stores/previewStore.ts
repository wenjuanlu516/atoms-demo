import { create } from 'zustand'

type Viewport = 'desktop' | 'mobile'

type PreviewState = {
  url: string | null
  viewport: Viewport
  error: string | null
  ready: boolean
  setViewport: (viewport: Viewport) => void
  setUrl: (url: string | null) => void
  setError: (error: string | null) => void
  markReady: () => void
  reset: () => void
}

export const usePreviewStore = create<PreviewState>((set) => ({
  url: null,
  viewport: 'desktop',
  error: null,
  ready: false,
  setViewport: (viewport) => set({ viewport }),
  setUrl: (url) => set({ url, ready: false, error: null }),
  setError: (error) => set({ error }),
  markReady: () => set({ ready: true }),
  reset: () => set({ url: null, error: null, ready: false }),
}))
