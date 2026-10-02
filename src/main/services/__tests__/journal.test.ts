import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// journal.ts pulls electron in via ./paths; pin the journal file to a temp dir
const dir = mkdtempSync(join(tmpdir(), 'ck-journal-'))
vi.mock('../paths', () => ({
  journalPath: () => join(dir, 'journal.json'),
  tmpDir: () => dir
}))

import { appendOp, loadJournal, undoOp } from '../journal'

const fileA = join(dir, 'aaa.txt')
const fileB = join(dir, '20230101_120305.txt')

describe('rename journal undo', () => {
  beforeEach(() => {
    writeFileSync(fileA, 'A')
  })

  afterEach(() => {
    for (const f of [fileA, fileB]) {
      try {
        rmSync(f)
      } catch {
        /* absent */
      }
    }
  })

  it('undo renames the file back to its original name', async () => {
    const op = await appendOp({
      ts: Date.now(),
      kind: 'rename',
      label: 'test',
      status: 'done',
      entries: [
        {
          path: fileB,
          before: { mtimeMs: 1, atimeMs: 1, birthtimeMs: 1 },
          after: {},
          rename: { from: 'aaa.txt' }
        }
      ]
    })

    mkdirSync(dir, { recursive: true })
    writeFileSync(fileB, 'A') // the rename happened on disk
    rmSync(fileA) // ...so the original name is gone
    expect(existsSync(fileA)).toBe(false)

    const res = await undoOp(op.id)
    expect(res.ok).toBe(true)
    expect(existsSync(fileA)).toBe(true)
    expect(existsSync(fileB)).toBe(false)

    const ops = await loadJournal()
    expect(ops[ops.length - 1].status).toBe('undone')
  })
})
