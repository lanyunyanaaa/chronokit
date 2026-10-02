import { create } from 'zustand'
import type { MatchMethod, MatchPair } from '@shared/index'
import { DEFAULT_MATCH_THRESHOLD } from '@shared/index'
import { matchTargets, type MatchFacts } from '@core/matcher'
import { useMediaStore, type VideoItem } from './mediaStore'

function toFacts(i: VideoItem): MatchFacts {
  return {
    path: i.path,
    nameNoExt: i.name.replace(/\.[^.]+$/, ''),
    size: i.size,
    durationSec: i.durationSec
  }
}

/** Pairing state between sources and targets, plus the fuzzy-match threshold. */
interface MatchState {
  pairs: Record<string, MatchPair>
  threshold: number
  setThreshold: (v: number) => void
  runMatch: () => void
  rebind: (targetPath: string, sourcePath: string | null, method?: MatchMethod) => void
  clearPairs: () => void
  /** Drop pairs whose target or source has left the media lists. */
  prunePairs: () => void
}

export const useMatchStore = create<MatchState>((set, get) => ({
  pairs: {},
  threshold: DEFAULT_MATCH_THRESHOLD,

  setThreshold: (v) => set({ threshold: v }),

  runMatch: () => {
    const { lists, items } = useMediaStore.getState()
    const facts = (paths: string[]): MatchFacts[] =>
      paths.flatMap((p) => (items[p] ? [toFacts(items[p])] : []))
    const res = matchTargets(facts(lists.sources), facts(lists.targets), {
      threshold: get().threshold
    })
    const pairs: Record<string, MatchPair> = {}
    for (const r of res) pairs[r.targetPath] = r
    set({ pairs })
  },

  rebind: (targetPath, sourcePath, method = 'manual') => {
    set((s) => {
      const pairs = { ...s.pairs }
      if (!sourcePath) delete pairs[targetPath]
      else pairs[targetPath] = { targetPath, sourcePath, method, score: 1 }
      return { pairs }
    })
  },

  clearPairs: () => set({ pairs: {} }),

  prunePairs: () => {
    const { lists } = useMediaStore.getState()
    const targets = new Set(lists.targets)
    const sources = new Set(lists.sources)
    set((s) => {
      let changed = false
      const pairs: Record<string, MatchPair> = {}
      for (const [tp, p] of Object.entries(s.pairs)) {
        if (targets.has(tp) && sources.has(p.sourcePath)) pairs[tp] = p
        else changed = true
      }
      return changed ? { pairs } : s
    })
  }
}))
