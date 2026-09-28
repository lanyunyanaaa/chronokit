import { create } from 'zustand'
import type { FileStatInfo, MatchPair, MediaInfo } from '@shared/index'
import { matchTargets, type MatchFacts } from '@core/matcher'
import { parseTimeFromFilename } from '@core/filename-time'
import { ck } from '@renderer/services/ck'

export type Kind = 'sources' | 'targets' | 'tools'
type ListKey = 'sources' | 'targets' | 'toolItems'

export interface VideoItem {
  path: string
  name: string
  size: number
  mtimeMs: number
  birthtimeMs: number
  durationSec?: number
  creationTimeIso?: string
  filenameTimeIso?: string
  filenamePattern?: string
  thumb?: string
  probing: boolean
  probeFailed?: boolean
}

export interface ProgressState {
  task: string
  done: number
  total: number
  message?: string
}

function keyOf(kind: Kind): ListKey {
  return kind === 'tools' ? 'toolItems' : kind
}

function toItem(st: FileStatInfo): VideoItem {
  const parsed = parseTimeFromFilename(st.name)
  return {
    path: st.path,
    name: st.name,
    size: st.size,
    mtimeMs: st.mtimeMs,
    birthtimeMs: st.birthtimeMs,
    filenameTimeIso: parsed ? parsed.date.toISOString() : undefined,
    filenamePattern: parsed?.patternLabel,
    probing: true
  }
}

function toFacts(i: VideoItem): MatchFacts {
  return {
    path: i.path,
    nameNoExt: i.name.replace(/\.[^.]+$/, ''),
    size: i.size,
    durationSec: i.durationSec
  }
}

interface AppState {
  activePage: string
  sources: VideoItem[]
  targets: VideoItem[]
  toolItems: VideoItem[]
  pairs: Record<string, MatchPair>
  busy: boolean
  progress: ProgressState | null
  threshold: number

  setPage: (p: string) => void
  setBusy: (b: boolean) => void
  setProgress: (p: ProgressState | null) => void
  setThreshold: (v: number) => void
  addPaths: (kind: Kind, rawPaths: string[]) => Promise<void>
  reprobe: (kind: Kind, paths?: string[]) => Promise<void>
  clearKind: (kind: Kind) => void
  removePaths: (kind: Kind, paths: string[]) => void
  setThumb: (kind: Kind, path: string, dataUrl: string) => void
  runMatch: () => void
  rebind: (targetPath: string, sourcePath: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'sync',
  sources: [],
  targets: [],
  toolItems: [],
  pairs: {},
  busy: false,
  progress: null,
  threshold: 0.75,

  setPage: (p) => set({ activePage: p }),
  setBusy: (b) => set({ busy: b }),
  setProgress: (p) => set({ progress: p }),
  setThreshold: (v) => set({ threshold: v }),

  addPaths: async (kind, rawPaths) => {
    if (!rawPaths.length) return
    const resolved = await ck.resolvePaths(rawPaths)
    const key = keyOf(kind)
    const existing = new Set(get()[key].map((i) => i.path))
    const fresh = resolved.filter((p) => !existing.has(p))
    if (!fresh.length) return
    const stats = await ck.statFiles(fresh)
    const items = stats.map(toItem)
    set((s) => ({ ...s, [key]: [...s[key], ...items] }))
    await get().reprobe(kind, fresh)
    if (kind !== 'tools' && get().sources.length && get().targets.length) {
      get().runMatch()
    }
  },

  reprobe: async (kind, paths) => {
    const key = keyOf(kind)
    const list = get()[key]
    const todo = paths ?? list.filter((i) => i.probing || i.probeFailed).map((i) => i.path)
    if (!todo.length) return
    const results = await ck.probeFiles(todo)
    const map = new Map<string, MediaInfo | null>()
    results.forEach((r, i) => map.set(todo[i], r))
    set((s) => ({
      ...s,
      [key]: s[key].map((item) => {
        if (!map.has(item.path)) return item
        const info = map.get(item.path)
        if (!info) return { ...item, probing: false, probeFailed: true }
        return {
          ...item,
          probing: false,
          probeFailed: false,
          durationSec: info.durationSec,
          creationTimeIso: info.creationTimeIso,
          size: info.size
        }
      })
    }))
  },

  clearKind: (kind) => {
    const key = keyOf(kind)
    set((s) => ({ ...s, [key]: [], ...(kind === 'targets' ? { pairs: {} } : {}) }))
  },

  removePaths: (kind, paths) => {
    const key = keyOf(kind)
    const rm = new Set(paths)
    set((s) => {
      const patch: Partial<AppState> = { [key]: s[key].filter((i) => !rm.has(i.path)) }
      if (kind !== 'tools') {
        const sources = patch.sources ?? s.sources
        const targets = patch.targets ?? s.targets
        const pairs: Record<string, MatchPair> = {}
        for (const [tp, p] of Object.entries(s.pairs)) {
          const targetOk = targets.some((t) => t.path === tp)
          const sourceOk = sources.some((sr) => sr.path === p.sourcePath)
          if (targetOk && sourceOk) pairs[tp] = p
        }
        patch.pairs = pairs
      }
      return { ...s, ...patch }
    })
  },

  setThumb: (kind, path, dataUrl) => {
    const key = keyOf(kind)
    set((s) => ({
      ...s,
      [key]: s[key].map((i) => (i.path === path ? { ...i, thumb: dataUrl } : i))
    }))
  },

  runMatch: () => {
    const { sources, targets, threshold } = get()
    const res = matchTargets(sources.map(toFacts), targets.map(toFacts), { threshold })
    const pairs: Record<string, MatchPair> = {}
    for (const r of res) pairs[r.targetPath] = r
    set({ pairs })
  },

  rebind: (targetPath, sourcePath) => {
    set((s) => {
      const pairs = { ...s.pairs }
      if (!sourcePath) delete pairs[targetPath]
      else pairs[targetPath] = { targetPath, sourcePath, method: 'manual', score: 1 }
      return { ...s, pairs }
    })
  }
}))
