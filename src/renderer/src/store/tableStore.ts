import { create } from 'zustand'
import type { FileEdits } from '@core/plan'

/**
 * Dirty-cell map for the batch editing table: per-file field overrides the
 * user typed but has not applied yet. Persisted with the session so an
 * editing session survives an app restart.
 */
interface TableState {
  edits: Record<string, FileEdits>
  setEdit: (path: string, edit: FileEdits) => void
  clearEdit: (path: string) => void
  /** Drop the given paths' edits (after they were applied successfully). */
  dropEdits: (paths: string[]) => void
  clearAll: () => void
  replaceAll: (edits: Record<string, FileEdits>) => void
}

export const useTableStore = create<TableState>((set) => ({
  edits: {},

  setEdit: (path, edit) =>
    set((s) => ({ edits: { ...s.edits, [path]: { ...s.edits[path], ...edit } } })),

  clearEdit: (path) =>
    set((s) => {
      if (!(path in s.edits)) return s
      const edits = { ...s.edits }
      delete edits[path]
      return { edits }
    }),

  dropEdits: (paths) =>
    set((s) => {
      let changed = false
      const edits = { ...s.edits }
      for (const p of paths) {
        if (p in edits) {
          delete edits[p]
          changed = true
        }
      }
      return changed ? { edits } : s
    }),

  clearAll: () => set({ edits: {} }),

  replaceAll: (edits) => set({ edits })
}))
