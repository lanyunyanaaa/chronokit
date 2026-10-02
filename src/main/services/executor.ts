import { randomUUID } from 'crypto'
import { promises as fsp, statSync, existsSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { ApplyItem, ExecResult, JournalFileEntry, JournalOp } from '@shared/index'
import { backupFile } from './backup'
import { isWin, setTimes, setCreationTimes } from './fileTime'
import { appendOp } from './journal'
import { writeMetadata } from './metadata'

type ProgressFn = (done: number, total: number, message?: string) => void

interface BeforeStat {
  mtimeMs: number
  atimeMs: number
  birthtimeMs: number
}

function statSafe(p: string): BeforeStat | null {
  try {
    const st = statSync(p)
    return { mtimeMs: st.mtimeMs, atimeMs: st.atimeMs, birthtimeMs: st.birthtimeMs }
  } catch {
    return null
  }
}

/**
 * Execute a batch of changes with full safety: backup before metadata
 * rewrites, automatic rollback on failure, mtime preservation across
 * remuxes, batched creation-time writes, and a journal op for undo.
 */
export async function applyChanges(
  items: ApplyItem[],
  kind: JournalOp['kind'],
  label: string,
  onProgress: ProgressFn
): Promise<ExecResult> {
  const entries: JournalFileEntry[] = []
  const ctimeBatch: { path: string; isoUtc: string }[] = []
  const errors: { path: string; message: string }[] = []
  let okCount = 0
  let failCount = 0
  const total = items.length

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress(i, total, item.path)
    const beforeStat = statSafe(item.path)
    const entry: JournalFileEntry = {
      path: item.path,
      before: beforeStat ?? { mtimeMs: 0, atimeMs: 0, birthtimeMs: 0 },
      after: {}
    }
    try {
      if (!beforeStat) throw new Error('file not found')

      let wroteMetadata = false
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        entry.backupPath = await backupFile(item.path)
        await writeMetadata(item.path, item.metadata)
        wroteMetadata = true
      }

      const times: { mtimeMs?: number; atimeMs?: number } = {}
      if (item.mtimeMs != null) {
        times.mtimeMs = item.mtimeMs
        if (item.atimeMs != null) times.atimeMs = item.atimeMs
      } else if (wroteMetadata) {
        // remux resets mtime to "now"; preserve the original unless the user
        // explicitly asked for a new mtime
        times.mtimeMs = beforeStat.mtimeMs
        times.atimeMs = beforeStat.atimeMs
      }
      if (times.mtimeMs != null || times.atimeMs != null) {
        await setTimes(item.path, times)
      }

      if (item.ctimeIso && isWin()) {
        ctimeBatch.push({ path: item.path, isoUtc: item.ctimeIso })
      }

      entry.after = {
        mtimeMs: item.mtimeMs ?? (wroteMetadata ? beforeStat.mtimeMs : undefined),
        atimeMs: item.atimeMs ?? (wroteMetadata ? beforeStat.atimeMs : undefined),
        birthtimeMs: item.ctimeIso ? new Date(item.ctimeIso).getTime() : undefined
      }
      okCount++
    } catch (err: any) {
      failCount++
      entry.error = String(err?.message ?? err)
      errors.push({ path: item.path, message: entry.error })
      if (entry.backupPath) {
        await fsp.copyFile(entry.backupPath, item.path).catch(() => {})
      }
    }
    entries.push(entry)
  }
  onProgress(total, total)

  if (ctimeBatch.length) {
    try {
      const res = await setCreationTimes(ctimeBatch)
      for (const r of res) {
        if (!r.ok) {
          errors.push({ path: r.path, message: r.error ?? 'creation time not applied' })
        }
      }
    } catch (err: any) {
      for (const c of ctimeBatch) {
        errors.push({ path: c.path, message: String(err?.message ?? err) })
      }
    }
  }

  await appendOp({ ts: Date.now(), kind, label, status: 'done', entries })

  return { okCount, failCount, errors }
}

export interface RenameRequest {
  path: string
  /** Target file NAME (not full path) in the same folder. */
  to: string
}

/**
 * Execute a batch of renames with journaling. Renames are inherently
 * reversible (undo = rename back), so no content backup is made; timestamps
 * survive the move untouched.
 */
export async function applyRenames(
  items: RenameRequest[],
  label: string,
  onProgress: ProgressFn
): Promise<ExecResult> {
  const entries: JournalFileEntry[] = []
  const errors: { path: string; message: string }[] = []
  let okCount = 0
  let failCount = 0

  for (let i = 0; i < items.length; i++) {
    const { path, to } = items[i]
    onProgress(i, items.length, path)
    const beforeStat = statSafe(path)
    const target = join(dirname(path), to)
    const entry: JournalFileEntry = {
      path: target,
      before: beforeStat ?? { mtimeMs: 0, atimeMs: 0, birthtimeMs: 0 },
      after: {},
      rename: { from: basename(path) }
    }
    try {
      if (!beforeStat) throw new Error('file not found')
      if (to !== basename(to)) throw new Error('target must be a file name')
      if (existsSync(target)) throw new Error('target name already exists')
      await fsp.rename(path, target)
      okCount++
    } catch (err: any) {
      failCount++
      entry.error = String(err?.message ?? err)
      errors.push({ path, message: entry.error })
    }
    entries.push(entry)
  }
  onProgress(items.length, items.length)

  await appendOp({ ts: Date.now(), kind: 'rename', label, status: 'done', entries })
  return { okCount, failCount, errors }
}
