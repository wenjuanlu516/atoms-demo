import type { ChangeKind } from '@/lib/diff'
import type { FileEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

export function FileTree({
  files,
  activePath,
  changedPaths,
  onSelect,
}: {
  files: FileEntry[]
  activePath: string | null
  changedPaths?: Record<string, ChangeKind>
  onSelect: (path: string) => void
}) {
  if (files.length === 0) {
    return <p className="px-3 py-6 text-xs text-mist">生成开始后，文件会在这里生长。</p>
  }

  return (
    <ul className="space-y-0.5 p-2">
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => onSelect(file.path)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs',
              activePath === file.path ? 'bg-accent/15 text-snow' : 'text-fog hover:bg-raised',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', file.writing ? 'animate-pulse bg-cyan' : 'bg-line-strong')} />
            <span className="min-w-0 flex-1 truncate">{file.path}</span>
            {changedPaths?.[file.path] === 'added' && (
              <span className="text-[10px] text-cyan">新</span>
            )}
            {changedPaths?.[file.path] === 'modified' && (
              <span className="text-[10px] text-amber">改</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
