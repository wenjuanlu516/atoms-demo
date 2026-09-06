import { create } from 'zustand'

import { createProject, deleteProject, getProject, getVersionFiles, listProjects } from '@/lib/api'
import { type ChangeKind, diffAgainstPrevious } from '@/lib/diff'
import type { FileEntry, Project } from '@/lib/types'

type ProjectState = {
  projects: Project[]
  current: Project | null
  files: FileEntry[]
  activePath: string | null
  changedPaths: Record<string, ChangeKind>
  prevContent: Record<string, string>
  loadList: () => Promise<void>
  loadOne: (pid: number) => Promise<void>
  refreshDiffs: (pid: number, version: number) => Promise<void>
  create: (prompt: string, title?: string) => Promise<Project>
  remove: (pid: number) => Promise<void>
  applyFileWrite: (path: string, content?: string, action?: string) => void
  setActivePath: (path: string) => void
  setStatus: (status: string) => void
  setVersion: (version: number) => void
  clearCurrent: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  current: null,
  files: [],
  activePath: null,
  changedPaths: {},
  prevContent: {},
  loadList: async () => {
    const projects = await listProjects()
    set({ projects })
  },
  loadOne: async (pid) => {
    const detail = await getProject(pid)
    set({
      current: {
        id: detail.id,
        title: detail.title,
        current_version: detail.current_version,
        status: detail.status,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
      },
      files: detail.files.map((file) => ({
        path: file.path,
        content: file.content ?? '',
        size: file.size,
      })),
      activePath: get().activePath && detail.files.some((file) => file.path === get().activePath)
        ? get().activePath
        : (detail.files[0]?.path ?? null),
    })
    void get().refreshDiffs(pid, detail.current_version)
  },
  refreshDiffs: async (pid, version) => {
    if (version < 2) {
      set({ changedPaths: {}, prevContent: {} })
      return
    }
    try {
      const previous = await getVersionFiles(pid, version - 1)
      const { changed, prevContent } = diffAgainstPrevious(previous, get().files)
      set({ changedPaths: changed, prevContent })
    } catch {
      set({ changedPaths: {}, prevContent: {} })
    }
  },
  create: async (prompt, title) => {
    const project = await createProject(prompt, title)
    set({ projects: [project, ...get().projects], current: project })
    return project
  },
  remove: async (pid) => {
    await deleteProject(pid)
    set({ projects: get().projects.filter((item) => item.id !== pid) })
  },
  applyFileWrite: (path, content = '', action = 'create') => {
    set((state) => {
      const exists = state.files.find((file) => file.path === path)
      const nextFiles = exists
        ? state.files.map((file) =>
            file.path === path
              ? { ...file, content, size: content.length, writing: action !== 'done' }
              : { ...file, writing: false },
          )
        : [...state.files.map((file) => ({ ...file, writing: false })), { path, content, size: content.length, writing: true }]
      return { files: nextFiles, activePath: path }
    })
  },
  setActivePath: (path) => set({ activePath: path }),
  setStatus: (status) =>
    set((state) => (state.current ? { current: { ...state.current, status } } : state)),
  setVersion: (version) =>
    set((state) =>
      state.current ? { current: { ...state.current, current_version: version, status: 'idle' } } : state,
    ),
  clearCurrent: () => set({ current: null, files: [], activePath: null, changedPaths: {}, prevContent: {} }),
}))
