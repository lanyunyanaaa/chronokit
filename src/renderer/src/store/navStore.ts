import { create } from 'zustand'

export type PageKey = 'sync' | 'tools' | 'inspector' | 'history'

interface NavState {
  activePage: PageKey
  setPage: (p: PageKey) => void
}

export const useNavStore = create<NavState>((set) => ({
  activePage: 'sync',
  setPage: (p) => set({ activePage: p })
}))
