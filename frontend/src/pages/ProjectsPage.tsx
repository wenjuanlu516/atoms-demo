import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ModelSelect } from '@/components/layout/ModelSelect'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { EXAMPLE_PROMPTS } from '@/lib/examples'
import { useChatStore } from '@/stores/chatStore'
import { useProjectStore } from '@/stores/projectStore'

export function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useProjectStore((state) => state.projects)
  const loadList = useProjectStore((state) => state.loadList)
  const create = useProjectStore((state) => state.create)
  const remove = useProjectStore((state) => state.remove)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void loadList()
  }, [loadList])

  const start = async (prompt: string, title?: string) => {
    setCreating(true)
    try {
      const chat = useChatStore.getState()
      chat.reset()
      chat.beginRound('build')
      chat.addUserMessage(prompt)
      const project = await create(prompt, title)
      useProjectStore.getState().setKeepChatId(project.id)
      navigate(`/w/${project.id}`)
    } catch {
      useChatStore.getState().reset()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-full bg-canvas">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            A
          </span>
          <div>
            <p className="text-sm font-semibold">Atoms</p>
            <p className="text-xs text-mist">我的项目</p>
          </div>
        </div>
        <UserMenu />
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="mb-10 rounded-3xl border border-line bg-panel p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-mist">New project</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">一句话，做成能跑的应用</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-fog">
            选择一个演示需求，或进入空白工作台自己描述。Mike 会召集团队完成需求分析、架构、编码和验证。
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {EXAMPLE_PROMPTS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={creating}
                onClick={() => void start(item.prompt, item.title)}
                className="rounded-2xl border border-line bg-raised p-4 text-left transition hover:border-accent/50"
              >
                <p className="text-sm font-medium text-snow">{item.title}</p>
                <p className="mt-1 text-xs text-mist">{item.hint}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button disabled={creating} onClick={() => navigate('/w/new')}>
              空白项目
            </Button>
            <ModelSelect />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-fog">我的项目</h2>
          {projects.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mist">
              还没有项目。从上面选一个示例开始。
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id} className="rounded-2xl border border-line bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="text-left" onClick={() => navigate(`/w/${project.id}`)}>
                      <p className="text-sm font-medium text-snow">{project.title}</p>
                      <p className="mt-1 font-mono text-[11px] text-mist">
                        v{project.current_version} · {project.status}
                      </p>
                    </button>
                    <Button variant="danger" className="h-8 px-2 text-xs" onClick={() => void remove(project.id)}>
                      删除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
