import { create } from 'zustand'

import { fetchHealth, getPreferredModel, setPreferredModel } from '@/lib/api'

type SettingsState = {
  ready: boolean
  llmMock: boolean
  defaultModel: string
  modelChoices: string[]
  selectedModel: string
  load: () => Promise<void>
  setModel: (model: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ready: false,
  llmMock: true,
  defaultModel: '',
  modelChoices: [],
  selectedModel: getPreferredModel(),
  load: async () => {
    const health = await fetchHealth()
    const choices = health.model_choices ?? []
    const saved = getPreferredModel()
    const selected = saved && choices.includes(saved) ? saved : choices[0] ?? health.llm_model
    if (selected && selected !== saved) setPreferredModel(selected)
    set({
      ready: true,
      llmMock: health.llm_mock,
      defaultModel: health.llm_model,
      modelChoices: choices,
      selectedModel: selected,
    })
  },
  setModel: (model) => {
    if (!get().modelChoices.includes(model)) return
    setPreferredModel(model)
    set({ selectedModel: model })
  },
}))
