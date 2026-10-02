import { randomUUID } from 'crypto'
import { promises as fsp } from 'fs'
import { dirname, join } from 'path'
import type { JournalOp } from '@shared/index'
import { journalPath } from './paths'
import { setTimes, setCreationTimes } from './fileTime'

export async function loadJournal(): Promise<JournalOp[]> {
  try {
    const raw = await fsp.readFile(journalPath(), 'utf8')
    const ops = JSON.parse(raw) as JournalOp[]
    return Array.isArray(ops) ? ops : []
  } catch {
    return []
  }
}

async function saveJournal(ops: JournalOp[]): Promise<void> {
  const tmp = `${journalPath()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(ops, null, 2), 'utf8')
  try {
    await fsp.rename(tmp, journalPath())
  } catch {
    await fsp.copyFile(tmp, journalPath())
    await fsp.unlink(tmp).catch(() => {})
  }
}

export async function appendOp(op: Omit<JournalOp, 'id'> & { id?: string }): Promise<JournalOp> {
  const full: JournalOp = { id: op.id ?? randomUUID(), ...op } as JournalOp
  const ops = await loadJournal()
  ops.push(full)
  await saveJournal(ops)
  return full
}

export interface UndoOutcome {
  ok: boolean
  message: string
}

/**
 * Undo one journal op: restore backups (metadata/content), then restore
 * mtime/atime/creation-time from the "before" snapshot.
 */
export async function undoOp(id: string): Promise<UndoOutcome> {
  const ops = await loadJournal()
  const op = ops.find((o) => o.id === id && o.status === 'done')
  if (!op) return { ok: false, message: 'OP_NOT_FOUND' }

  const ctimeItems: { path: string; isoUtc: string }[] = []

  for (const e of [...op.entries].reverse()) {
    try {
      if (e.rename) {
        // undo a rename: move the file back to its original name; timestamps
        // never changed, so there is nothing else to restore
        await fsp.rename(e.path, join(dirname(e.path), e.rename.from))
        continue
      }
      if (e.backupPath) {
        await fsp.copyFile(e.backupPath, e.path)
      }
      await setTimes(e.path, { mtimeMs: e.before.mtimeMs, atimeMs: e.before.atimeMs })
      ctimeItems.push({ path: e.path, isoUtc: new Date(e.before.birthtimeMs).toISOString() })
    } catch (err: any) {
      e.error = String(err?.message ?? err)
    }
  }

  let ctimeError: string | undefined
  try {
    const res = await setCreationTimes(ctimeItems)
    const bad = res.filter((r) => !r.ok)
    if (bad.length) ctimeError = `${bad.length} creation time(s) not restored`
  } catch (err: any) {
    ctimeError = String(err?.message ?? err)
  }

  op.status = 'undone'
  await saveJournal(ops)

  const failed = op.entries.filter((e) => e.error).length
  if (failed > 0) return { ok: false, message: `PARTIAL:${failed}` }
  if (ctimeError) return { ok: true, message: `CTIME_PARTIAL:${ctimeError}` }
  return { ok: true, message: 'OK' }
}
