import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { listVersions, publishProject, rollbackVersion } from '@/lib/api'
import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function TopBar() {
  const navigate = useNavigate()
  const current = useProjectStore((state) => state.current)
  const loadOne = useProjectStore((state) => state.loadOne)
  const [versions, setVersions] = useState<{ version: number; summary: string | null }[]>([])
  const [publishUrl, setPublishUrl] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!current?.id || current.current_version < 1) return
    void listVersions(current.id).then(setVersions)
  }, [current?.id, current?.current_version])

  return (
    <header className="flex h-12 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex items-center gap-3">
        <button type="button" className="flex items-center gap-2" onClick={() => navigate('/')}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight">Atoms</span>
        </button>
        <span className="text-line-strong">/</span>
        <span className="max-w-[240px] truncate text-sm text-fog">{current?.title ?? '新项目'}</span>
        {current && versions.length > 0 && (
          <select
            className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fog"
            value={current.current_version}
            onChange={async (event) => {
              const version = Number(event.target.value)
              if (!current) return
              await rollbackVersion(current.id, version)
              await loadOne(current.id)
              usePreviewStore.getState().setUrl(`/preview/${current.id}/v${version}/index.html`)
              useChatStore.getState().addSystemNote(`已回滚到 v${version}。代码和预览已切换，对话记录保留。`)
            }}
          >
            {versions.map((item) => (
              <option key={item.version} value={item.version}>
                v{item.version}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-3">
        {publishUrl && (
          <a className="font-mono text-[11px] text-cyan hover:underline" href={publishUrl} target="_blank" rel="noreferrer">
            {publishUrl}
          </a>
        )}
        <Button
          variant="outline"
          disabled={!current || current.current_version < 1 || publishing}
          onClick={async () => {
            if (!current) return
            setPublishing(true)
            try {
              const result = await publishProject(current.id)
              setPublishUrl(result.url)
            } finally {
              setPublishing(false)
            }
          }}
        >
          Publish
        </Button>
        <UserMenu compact />
      </div>
    </header>
  )
}
