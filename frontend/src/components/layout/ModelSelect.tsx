import { useSettingsStore } from '@/stores/settingsStore'

function shortName(model: string): string {
  const tail = model.split('/').pop() ?? model
  return tail.replace(/-latest$/, '')
}

export function ModelSelect({ compact = false }: { compact?: boolean }) {
  const llmMock = useSettingsStore((state) => state.llmMock)
  const choices = useSettingsStore((state) => state.modelChoices)
  const selected = useSettingsStore((state) => state.selectedModel)
  const setModel = useSettingsStore((state) => state.setModel)

  if (choices.length === 0) return null

  return (
    <label className="flex shrink-0 items-center gap-1 text-[11px] text-mist">
      {!compact && <span>{llmMock ? '演示' : '模型'}</span>}
      <select
        className="max-w-[140px] rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-fog"
        value={selected}
        title={llmMock ? '当前为模板演示；关闭 LLM_MOCK 后按此模型调用' : selected}
        onChange={(event) => setModel(event.target.value)}
      >
        {choices.map((model) => (
          <option key={model} value={model}>
            {shortName(model)}
          </option>
        ))}
      </select>
    </label>
  )
}
