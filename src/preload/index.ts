import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  ApplyItem,
  ExecResult,
  FileStatInfo,
  JournalOp,
  MediaInfo,
  TaskProgress
} from '../shared/index'

const api = {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:select-files'),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),
  resolvePaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('fs:resolve-paths', paths),
  statFiles: (paths: string[]): Promise<FileStatInfo[]> => ipcRenderer.invoke('fs:stat-files', paths),
  probeFiles: (paths: string[]): Promise<(MediaInfo | null)[]> =>
    ipcRenderer.invoke('media:probe-files', paths),
  getThumb: (path: string, durationSec?: number): Promise<string | null> =>
    ipcRenderer.invoke('thumb:get', path, durationSec),
  applyChanges: (
    items: ApplyItem[],
    kind: JournalOp['kind'],
    label: string
  ): Promise<ExecResult> => ipcRenderer.invoke('exec:apply', { items, kind, label }),
  journalList: (): Promise<JournalOp[]> => ipcRenderer.invoke('journal:list'),
  journalUndo: (id: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('journal:undo', id),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  /** Resolve the absolute path of a File dropped from the OS. */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  onTaskProgress: (cb: (p: TaskProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, p: TaskProgress): void => cb(p)
    ipcRenderer.on('task-progress', listener)
    return () => {
      ipcRenderer.removeListener('task-progress', listener)
    }
  }
}

contextBridge.exposeInMainWorld('ckApi', api)

export type CkApi = typeof api
