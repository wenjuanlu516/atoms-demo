import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isLogin = mode === 'login'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      if (isLogin) await signIn(username, password)
      else await signUp(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white">
            A
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist">Atoms Demo</p>
            <h1 className="text-xl font-semibold">{isLogin ? '登录' : '创建账号'}</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-fog">
          轻量账户，用户名 + 密码即可。项目会按用户隔离并持久化。
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            autoComplete="username"
            placeholder="用户名（字母数字下划线）"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="text-xs text-rose">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? '请稍候…' : isLogin ? '进入工作台' : '注册并进入'}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-mist">
          {isLogin ? (
            <>
              还没有账号？{' '}
              <Link className="text-accent-soft hover:underline" to="/register">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账号？{' '}
              <Link className="text-accent-soft hover:underline" to="/login">
                登录
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
