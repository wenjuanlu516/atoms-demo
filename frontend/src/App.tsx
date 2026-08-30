import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AuthPage } from '@/pages/AuthPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

function Guard() {
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  if (!ready) {
    return <div className="flex h-full items-center justify-center text-sm text-mist">加载中…</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function Guest() {
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  if (!ready) {
    return <div className="flex h-full items-center justify-center text-sm text-mist">加载中…</div>
  }
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const loadSettings = useSettingsStore((state) => state.load)

  useEffect(() => {
    void hydrate()
    void loadSettings()
  }, [hydrate, loadSettings])

  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <BrowserRouter basename={basename || undefined}>
      <Routes>
        <Route element={<Guest />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>
        <Route element={<Guard />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/w/:pid" element={<WorkspacePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
