import type { FileEntry } from '@/lib/types'

export type ChangeKind = 'added' | 'modified'

export function diffAgainstPrevious(
  previous: { path: string; content: string }[],
  current: FileEntry[],
): { changed: Record<string, ChangeKind>; prevContent: Record<string, string> } {
  const prevContent = Object.fromEntries(previous.map((file) => [file.path, file.content]))
  const changed: Record<string, ChangeKind> = {}
  for (const file of current) {
    if (!(file.path in prevContent)) changed[file.path] = 'added'
    else if (prevContent[file.path] !== file.content) changed[file.path] = 'modified'
  }
  return { changed, prevContent }
}

export function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs') return 'javascript'
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'css') return 'css'
  if (ext === 'html' || ext === 'htm' || ext === 'vue') return 'html'
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'markdown'
  return 'plaintext'
}
