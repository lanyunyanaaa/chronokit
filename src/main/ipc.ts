import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { AppInfo, ApplyItem, JournalOp, RecentDir, SessionSnapshot } from '@shared/index'
import { resolveFfmpeg } from './services/ffmpeg'
import { resolveMediaPaths, statFiles } from './services/files'
import { getDataRoot } from './services/paths'
import { probeFiles } from './services/probe'
import { getThumbDataUrl } from './services/thumbs'
import { getShellThumbUrl } from './services/shellThumb'
import { addRecentDir, listRecentDirs } from './services/recents'
import { loadSession, saveSession } from './services/session'
import { deleteBackupFiles, listBackupGroups, restoreBackupFile } from './services/backups'
import { applyChanges, applyRenames, type RenameRequest } from './services/executor'
import { loadJournal, undoOp } from './services/journal'

const MEDIA_FILTERS = [
  {
    name: 'Video',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mpg', 'mpeg', 'm4v', 'webm', 'ts', '3gp']
  },
  { name: 'Photos (EXIF)', extensions: ['jpg', 'jpeg', 'png'] }
]

export function registerIpc(): void {
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())

  ipcMain.on('win:toggle-maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })

  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  ipcMain.handle('dialog:select-files', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: MEDIA_FILTERS
    })
    return r.canceled ? [] : r.filePaths
  })

  ipcMain.handle('dialog:select-folder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })

  ipcMain.handle('fs:resolve-paths', (_e, paths: string[]) => resolveMediaPaths(paths))

  ipcMain.handle('fs:stat-files', (_e, paths: string[]) => statFiles(paths))

  ipcMain.handle('media:probe-files', (e, paths: string[]) => {
    let last = 0
    return probeFiles(paths, (done, total) => {
      const now = Date.now()
      if (done === total || now - last > 150) {
        last = now
        e.sender.send('task-progress', { task: 'probe', done, total })
      }
    })
  })

  ipcMain.handle(
    'thumb:get',
    (
      _e,
      path: string,
      size: number,
      mtimeMs: number,
      durationSec?: number
    ): Promise<string | null> => {
      // screenshot automation: skip the shell worker entirely so the walk is
      // deterministic (rows render placeholders)
      if (process.env.CK_SHOT) return Promise.resolve(null)
      // Windows: read the shell's own thumbnail cache instead of extracting.
      if (process.platform === 'win32') return getShellThumbUrl(path, size, mtimeMs)
      return getThumbDataUrl(path, durationSec)
    }
  )

  ipcMain.handle('recents:list', (): Promise<RecentDir[]> => listRecentDirs())

  ipcMain.handle('recents:add', (_e, dir: string): Promise<RecentDir[]> => addRecentDir(dir))

  ipcMain.handle('session:load', async () => {
    const snap = process.env.CK_SHOT ? null : await loadSession()
    console.log(
      '[session] load →',
      snap
        ? Object.entries(snap.lists)
            .map(([k, v]) => `${k}:${v.length}`)
            .join(' ') + ` page=${snap.activePage}`
        : 'null'
    )
    return snap
  })
  ipcMain.handle('session:save', (_e, snapshot: SessionSnapshot) => saveSession(snapshot))

  ipcMain.handle('exec:apply', (e, payload: { items: ApplyItem[]; kind: JournalOp['kind']; label: string }) => {
    const sender = e.sender
    return applyChanges(payload.items, payload.kind, payload.label, (done, total, message) => {
      sender.send('task-progress', { task: 'exec', done, total, message })
    })
  })

  ipcMain.handle('exec:rename', (e, payload: { items: RenameRequest[]; label: string }) => {
    const sender = e.sender
    return applyRenames(payload.items, payload.label, (done, total, message) => {
      sender.send('task-progress', { task: 'exec', done, total, message })
    })
  })

  ipcMain.handle('journal:list', () => loadJournal())

  ipcMain.handle('journal:undo', (_e, id: string) => undoOp(id))

  ipcMain.handle('backups:list', () => listBackupGroups())
  ipcMain.handle('backups:restore', (_e, payload: { backupPath: string; path: string; mtimeMs: number }) =>
    restoreBackupFile(payload.backupPath, payload.path, payload.mtimeMs)
  )
  ipcMain.handle('backups:delete', (_e, paths: string[]) => deleteBackupFiles(paths))

  ipcMain.handle('app:info', (): AppInfo => {
    let ffmpegPath: string | undefined
    let ffprobePath: string | undefined
    let ffmpegError: string | undefined
    try {
      const b = resolveFfmpeg()
      ffmpegPath = b.ffmpeg
      ffprobePath = b.ffprobe
    } catch {
      ffmpegError = 'FFMPEG_NOT_FOUND'
    }
    return {
      version: app.getVersion(),
      platform: process.platform,
      dataRoot: getDataRoot(),
      isPackaged: app.isPackaged,
      ffmpegPath,
      ffprobePath,
      ffmpegError
    }
  })
}
