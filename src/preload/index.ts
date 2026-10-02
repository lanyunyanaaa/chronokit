import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  ApplyItem,
  BackupGroup,
  ExecResult,
  FileStatInfo,
  JournalOp,
  MediaInfo,
  RecentDir,
  SessionSnapshot,
  TaskProgress
} from '../shared/index'

const api = {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:select-files'),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),
  resolvePaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('fs:resolve-paths', paths),
  statFiles: (paths: string[]): Promise<FileStatInfo[]> => ipcRenderer.invoke('fs:stat-files', paths),
  probeFiles: (paths: string[]): Promise<(MediaInfo | null)[]> =>
    ipcRenderer.invoke('media:probe-files', paths),
  getThumb: (
    path: string,
    size: number,
    mtimeMs: number,
    durationSec?: number
  ): Promise<string | null> => ipcRenderer.invoke('thumb:get', path, size, mtimeMs, durationSec),
  recentsList: (): Promise<RecentDir[]> => ipcRenderer.invoke('recents:list'),
  recentsAdd: (path: string): Promise<RecentDir[]> => ipcRenderer.invoke('recents:add', path),
  sessionLoad: (): Promise<SessionSnapshot | null> => ipcRenderer.invoke('session:load'),
  sessionSave: (snapshot: SessionSnapshot): Promise<void> =>
    ipcRenderer.invoke('session:save', snapshot),
  applyChanges: (
    items: ApplyItem[],
    kind: JournalOp['kind'],
    label: string
  ): Promise<ExecResult> => ipcRenderer.invoke('exec:apply', { items, kind, label }),
  applyRenames: (items: { path: string; to: string }[], label: string): Promise<ExecResult> =>
    ipcRenderer.invoke('exec:rename', { items, label }),
  journalList: (): Promise<JournalOp[]> => ipcRenderer.invoke('journal:list'),
  journalUndo: (id: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('journal:undo', id),
  backupsList: (): Promise<BackupGroup[]> => ipcRenderer.invoke('backups:list'),
  backupsRestore: (backupPath: string, path: string, mtimeMs: number): Promise<void> =>
    ipcRenderer.invoke('backups:restore', { backupPath, path, mtimeMs }),
  backupsDelete: (paths: string[]): Promise<number> => ipcRenderer.invoke('backups:delete', paths),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  /** Resolve the absolute path of a File dropped from the OS. */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  minimizeWindow: (): void => ipcRenderer.send('win:minimize'),
  toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
  closeWindow: (): void => ipcRenderer.send('win:close'),
  onWindowState: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, v: boolean): void => cb(v)
    ipcRenderer.on('win:maximized', listener)
    return () => {
      ipcRenderer.removeListener('win:maximized', listener)
    }
  },

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
