import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/stores/authStore'

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const initial = user.username.slice(0, 1).toUpperCase()

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          compact
            ? 'flex max-w-[180px] items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-mist hover:bg-raised hover:text-snow'
            : 'flex items-center gap-2 rounded-xl border border-line bg-raised px-2.5 py-1.5 text-xs text-fog hover:border-line-strong hover:text-snow'
        }
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="账户菜单"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent-soft">
          {initial}
        </span>
        <span className="truncate">{compact ? user.username : `你好，${user.username}`}</span>
        <span className="text-[10px] text-mist" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 min-w-[160px] rounded-xl border border-line bg-panel py-1 shadow-xl"
        >
          <p className="truncate px-3 py-1.5 text-[11px] text-mist">{user.username}</p>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs text-fog hover:bg-raised hover:text-snow"
            onClick={() => {
              setOpen(false)
              navigate('/')
            }}
          >
            我的项目
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs text-rose hover:bg-raised"
            onClick={() => {
              setOpen(false)
              signOut()
              navigate('/login')
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
