import { create } from 'zustand'

export const PAGE_KEYS = [
  'checkup', 'sync', 'tools', 'table', 'rename', 'inspector', 'backups', 'history'
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export function isPageKey(v: string): v is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(v)
}

interface NavState {
  activePage: PageKey
  setPage: (p: PageKey) => void
}

export const useNavStore = create<NavState>((set) => ({
  activePage: 'sync',
  setPage: (p) => set({ activePage: p })
}))
