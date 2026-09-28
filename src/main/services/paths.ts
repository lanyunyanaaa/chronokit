import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let dataRoot: string | null = null

/**
 * Resolve the app data root. In dev everything stays inside the repo
 * (.data/), packaged installs use the OS userData dir unless CK_DATA_DIR
 * is set. Call once at startup.
 */
export function initDataRoot(): string {
  if (dataRoot) return dataRoot
  if (!app.isPackaged && !process.env.CK_DATA_DIR) {
    process.env.CK_DATA_DIR = join(app.getAppPath(), '.data')
  }
  dataRoot = process.env.CK_DATA_DIR || join(app.getPath('userData'), 'chronokit-data')
  mkdirSync(join(dataRoot, 'backups'), { recursive: true })
  mkdirSync(join(dataRoot, 'cache', 'thumbs'), { recursive: true })
  mkdirSync(join(dataRoot, 'tmp'), { recursive: true })
  return dataRoot
}

export function getDataRoot(): string {
  return initDataRoot()
}

export function backupDir(): string {
  return join(getDataRoot(), 'backups')
}

export function thumbCacheDir(): string {
  return join(getDataRoot(), 'cache', 'thumbs')
}

export function tmpDir(): string {
  return join(getDataRoot(), 'tmp')
}

export function journalPath(): string {
  return join(getDataRoot(), 'journal.json')
}
