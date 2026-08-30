import { DiffEditor, Editor, type OnMount } from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { languageFor } from '@/lib/diff'
import type { FileEntry } from '@/lib/types'

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
  lineHeight: 20,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on' as const,
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: 'line' as const,
  overviewRulerLanes: 0,
}

export function CodeEditor({
  file,
  previous,
  changeKind,
  onSave,
}: {
  file: FileEntry | null
  previous?: string
  changeKind?: 'added' | 'modified'
  onSave?: (path: string, content: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(file?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = false
    setDraft(file?.content ?? '')
    setShowDiff(false)
  }, [file?.path])

  useEffect(() => {
    if (!file) return
    if (file.writing || !dirtyRef.current) setDraft(file.content)
  }, [file])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !file?.writing) return
    const line = editor.getModel()?.getLineCount() ?? 1
    editor.revealLine(line)
  }, [file?.content, file?.writing])

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-mist">
        选择一个文件查看源码
      </div>
    )
  }

  const language = languageFor(file.path)
  const canDiff = Boolean(previous != null && changeKind === 'modified')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-mono text-xs text-fog">{file.path}</p>
          {changeKind === 'added' && (
            <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[10px] text-cyan">新增</span>
          )}
          {changeKind === 'modified' && (
            <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] text-amber">已改</span>
          )}
          {file.writing && <span className="text-[11px] text-cyan">正在写入…</span>}
        </div>
        <div className="flex items-center gap-2">
          {canDiff && (
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowDiff((value) => !value)}>
              {showDiff ? '源码' : '对比上一版'}
            </Button>
          )}
          {onSave && !showDiff && (
            <Button
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={saving || draft === file.content}
              onClick={async () => {
                setSaving(true)
                try {
                  await onSave(file.path, draft)
                } finally {
                  setSaving(false)
                }
              }}
            >
              保存
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {showDiff && previous != null ? (
          <DiffEditor
            height="100%"
            language={language}
            original={previous}
            modified={draft}
            theme="vs-dark"
            options={{ ...editorOptions, readOnly: true, renderSideBySide: false }}
            loading={<p className="px-3 py-4 text-xs text-mist">加载对比…</p>}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            path={file.path}
            value={draft}
            theme="vs-dark"
            options={{ ...editorOptions, readOnly: Boolean(file.writing) }}
            loading={<p className="px-3 py-4 text-xs text-mist">加载编辑器…</p>}
            onChange={(value) => {
              dirtyRef.current = true
              setDraft(value ?? '')
            }}
            onMount={(editor) => {
              editorRef.current = editor
              if (file.writing) {
                const line = editor.getModel()?.getLineCount() ?? 1
                editor.revealLine(line)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
