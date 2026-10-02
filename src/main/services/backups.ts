import { promises as fsp, statSync } from 'fs'
import { resolve, sep } from 'path'
import type { BackupFileRow, BackupGroup } from '@shared/index'
import { backupDir } from './paths'
import { loadJournal } from './journal'
import { setTimes } from './fileTime'

/**
 * Backup center: groups the journal's per-file backups into ops and reports
 * their disk footprint. Delete/restore paths are validated against the
 * backup root so a tampered journal can't point us at arbitrary files.
 */

function statSize(p: string): number | null {
  try {
    return statSync(p).size
  } catch {
    return null
  }
}

export async function listBackupGroups(): Promise<BackupGroup[]> {
  const ops = await loadJournal()
  const root = resolve(backupDir()).toLowerCase()
  const groups: BackupGroup[] = []

  for (const op of ops) {
    const files: BackupFileRow[] = []
    for (const e of op.entries) {
      if (!e.backupPath) continue
      const resolved = resolve(e.backupPath)
      if (!resolved.toLowerCase().startsWith(root + sep) && resolved.toLowerCase() !== root) continue
      const size = statSize(resolved)
      files.push({
        path: e.path,
        backupPath: resolved,
        size: size ?? 0,
        missing: size == null,
        mtimeMs: e.before.mtimeMs
      })
    }
    groups.push({
      opId: op.id,
      ts: op.ts,
      kind: op.kind,
      label: op.label,
      status: op.status,
      files,
      totalSize: files.reduce((n, f) => n + f.size, 0),
      active: op.status === 'done'
    })
  }
  return groups.reverse() // newest first
}

/** Copy one backup over its original file and restore the mtime snapshot. */
export async function restoreBackupFile(
  backupPath: string,
  originalPath: string,
  mtimeMs: number
): Promise<void> {
  const root = resolve(backupDir()).toLowerCase()
  const resolved = resolve(backupPath)
  if (!resolved.toLowerCase().startsWith(root + sep)) throw new Error('backup path outside backup dir')
  await fsp.copyFile(resolved, originalPath)
  await setTimes(originalPath, { mtimeMs, atimeMs: mtimeMs })
}

export async function deleteBackupFiles(paths: string[]): Promise<number> {
  const root = resolve(backupDir()).toLowerCase()
  let deleted = 0
  for (const p of paths) {
    const resolved = resolve(p)
    if (!resolved.toLowerCase().startsWith(root + sep)) continue
    try {
      await fsp.unlink(resolved)
      deleted++
    } catch {
      /* already gone */
    }
  }
  return deleted
}