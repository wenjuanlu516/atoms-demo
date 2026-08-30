import { CodeEditor } from '@/components/code/CodeEditor'
import { FileTree } from '@/components/code/FileTree'
import { saveFile } from '@/lib/api'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

export function CodePanel() {
  const files = useProjectStore((state) => state.files)
  const activePath = useProjectStore((state) => state.activePath)
  const setActivePath = useProjectStore((state) => state.setActivePath)
  const current = useProjectStore((state) => state.current)
  const loadOne = useProjectStore((state) => state.loadOne)
  const changedPaths = useProjectStore((state) => state.changedPaths)
  const prevContent = useProjectStore((state) => state.prevContent)
  const file = files.find((item) => item.path === activePath) ?? null

  return (
    <section className="flex h-full min-w-0 flex-col border-r border-line bg-canvas">
      <div className="border-b border-line px-3 py-2 text-xs font-medium uppercase tracking-wider text-mist">
        Code
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr]">
        <div className="overflow-auto border-r border-line">
          <FileTree files={files} activePath={activePath} changedPaths={changedPaths} onSelect={setActivePath} />
        </div>
        <CodeEditor
          file={file}
          previous={file ? prevContent[file.path] : undefined}
          changeKind={file ? changedPaths[file.path] : undefined}
          onSave={
            current
              ? async (path, content) => {
                  const result = await saveFile(current.id, path, content)
                  await loadOne(current.id)
                  usePreviewStore.getState().setUrl(`/preview/${current.id}/v${result.version}/index.html`)
                }
              : undefined
          }
        />
      </div>
    </section>
  )
}
