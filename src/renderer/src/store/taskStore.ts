import { create } from 'zustand'
import type { TaskProgress } from '@shared/index'

/**
 * The one global task slot: whichever main-process operation is currently
 * running (probe/exec/…). Consumed by the global TaskStatus pill.
 */
interface TaskState {
  busy: boolean
  progress: TaskProgress | null
  setBusy: (b: boolean) => void
  setProgress: (p: TaskProgress | null) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  busy: false,
  progress: null,
  setBusy: (b) => set({ busy: b }),
  setProgress: (p) => set({ progress: p })
}))
