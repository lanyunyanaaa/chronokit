import { create } from 'zustand'
import type { FileStatInfo, MediaInfo } from '@shared/index'
import { parseTimeFromFilename } from '@core/filename-time'
import { ck } from '@renderer/services/ck'
import { useMatchStore } from './matchStore'

export type Kind = 'sources' | 'targets' | 'tools' | 'checkup' | 'table' | 'rename'

/** One media file, addressed by its absolute path. */
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
  probing: boolean
  probeFailed?: boolean
}

/** Probe chunk size: results fill in progressively instead of one blocking batch. */
const CHUNK = 20

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

/**
 * Normalized media index: one `items` record keyed by absolute path, while
 * each page only keeps an ordered list of paths. A file used on several pages
 * is probed, thumbnailed and updated exactly once, and a probe result patch
 * re-renders only the row(s) showing that path.
 */
interface MediaState {
  items: Record<string, VideoItem>
  lists: Record<Kind, string[]>
  addPaths: (kind: Kind, rawPaths: string[], opts?: { autoMatch?: boolean }) => Promise<void>
  reprobe: (kind: Kind, paths?: string[]) => Promise<void>
  clearKind: (kind: Kind) => void
  removePaths: (kind: Kind, paths: string[]) => void
  /** After renames: remap item keys and every list so rows stay live. */
  renamePaths: (pairs: { from: string; to: string; toName: string }[]) => void
}

/** Drop items that no longer belong to any list. */
function compact(
  lists: Record<Kind, string[]>,
  items: Record<string, VideoItem>
): Record<string, VideoItem> {
  const alive = new Set([
    ...lists.sources,
    ...lists.targets,
    ...lists.tools,
    ...lists.checkup,
    ...lists.table,
    ...lists.rename
  ])
  const next: Record<string, VideoItem> = {}
  for (const [p, item] of Object.entries(items)) if (alive.has(p)) next[p] = item
  return next
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: {},
  lists: { sources: [], targets: [], tools: [], checkup: [], table: [], rename: [] },

  addPaths: async (kind, rawPaths, opts) => {
    if (!rawPaths.length) return
    const resolved = await ck.resolvePaths(rawPaths)
    const existing = new Set(get().lists[kind])
    const fresh = resolved.filter((p) => !existing.has(p))
    if (!fresh.length) return
    const stats = await ck.statFiles(fresh)
    set((s) => {
      const items = { ...s.items }
      for (const st of stats) items[st.path] = toItem(st)
      return {
        items,
        lists: { ...s.lists, [kind]: [...s.lists[kind], ...stats.map((st) => st.path)] }
      }
    })
    await get().reprobe(kind, fresh)
    if (opts?.autoMatch === false) return
    const { sources, targets } = get().lists
    if ((kind === 'sources' || kind === 'targets') && sources.length && targets.length) {
      useMatchStore.getState().runMatch()
    }
  },

  reprobe: async (kind, paths) => {
    const list = get().lists[kind]
    const items = get().items
    const todo =
      paths ?? list.filter((p) => items[p] && (items[p].probing || items[p].probeFailed))
    if (!todo.length) return
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK)
      const results = await ck.probeFiles(chunk)
      const byPath = new Map<string, MediaInfo | null>()
      results.forEach((r, j) => byPath.set(chunk[j], r))
      set((s) => {
        const next = { ...s.items }
        for (const [path, info] of byPath) {
          const item = next[path]
          if (!item) continue
          next[path] = info
            ? {
                ...item,
                probing: false,
                probeFailed: false,
                durationSec: info.durationSec,
                creationTimeIso: info.creationTimeIso,
                size: info.size
              }
            : { ...item, probing: false, probeFailed: true }
        }
        return { items: next }
      })
    }
  },

  clearKind: (kind) => {
    set((s) => {
      const lists = { ...s.lists, [kind]: [] }
      return { items: compact(lists, s.items), lists }
    })
    if (kind === 'sources' || kind === 'targets') useMatchStore.getState().prunePairs()
  },

  removePaths: (kind, paths) => {
    const rm = new Set(paths)
    set((s) => {
      const lists = { ...s.lists, [kind]: s.lists[kind].filter((p) => !rm.has(p)) }
      return { items: compact(lists, s.items), lists }
    })
    if (kind === 'sources' || kind === 'targets') useMatchStore.getState().prunePairs()
  },

  renamePaths: (pairs) => {
    if (!pairs.length) return
    const byFrom = new Map(pairs.map((p) => [p.from, p]))
    set((s) => {
      const remap = (p: string): string => {
        const hit = byFrom.get(p)
        return hit ? hit.to : p
      }
      const items: Record<string, VideoItem> = {}
      for (const [p, item] of Object.entries(s.items)) {
        const hit = byFrom.get(p)
        if (hit) {
          items[hit.to] = {
            ...item,
            path: hit.to,
            name: hit.toName,
            // the name changed, so a name-derived timestamp is stale
            filenameTimeIso: undefined,
            filenamePattern: undefined,
            probing: true
          }
        } else {
          items[p] = item
        }
      }
      const lists = Object.fromEntries(
        Object.entries(s.lists).map(([k, arr]) => [k, arr.map(remap)])
      ) as Record<Kind, string[]>
      useMatchStore.getState().remapPaths(pairs.map((p) => ({ from: p.from, to: p.to })))
      return { items, lists }
    })
  }
}))

/** Row-level selector: a component reading one item only re-renders when it changes. */
export function useMediaItem(path: string): VideoItem | undefined {
  return useMediaStore((s) => s.items[path])
}
