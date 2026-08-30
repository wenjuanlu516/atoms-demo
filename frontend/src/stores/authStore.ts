import { create } from 'zustand'

import { fetchMe, getToken, login, register, setToken } from '@/lib/api'
import type { User } from '@/lib/types'

type AuthState = {
  user: User | null
  ready: boolean
  error: string | null
  hydrate: () => Promise<void>
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, password: string) => Promise<void>
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,
  hydrate: async () => {
    if (!getToken()) {
      set({ user: null, ready: true })
      return
    }
    try {
      const user = await fetchMe()
      set({ user, ready: true, error: null })
    } catch {
      setToken(null)
      set({ user: null, ready: true })
    }
  },
  signIn: async (username, password) => {
    const result = await login(username, password)
    setToken(result.token)
    set({ user: result.user, error: null })
  },
  signUp: async (username, password) => {
    const result = await register(username, password)
    setToken(result.token)
    set({ user: result.user, error: null })
  },
  signOut: () => {
    setToken(null)
    set({ user: null })
  },
}))
