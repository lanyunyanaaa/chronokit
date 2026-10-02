import { describe, expect, it } from 'vitest'
import { buildEditsPlan } from '../plan'

describe('buildEditsPlan', () => {
  const isWin = false
  const base = {
    path: 'C:/v/a.mp4',
    name: 'a.mp4',
    creationTimeIso: '2023-01-01T04:00:00Z',
    filenameTimeIso: null,
    mtimeMs: new Date('2023-01-01T04:00:00Z').getTime(),
    birthtimeMs: new Date('2023-01-01T04:00:00Z').getTime()
  }

  it('emits one item per edited file with only touched fields', () => {
    const r = buildEditsPlan(
      [base],
      { 'C:/v/a.mp4': { metadataMs: new Date('2023-02-02T08:00:00Z').getTime() } },
      isWin
    )
    expect(r.items).toHaveLength(1)
    expect(r.items[0].apply.metadata).toBeDefined()
    expect(r.items[0].apply.mtimeMs).toBeUndefined()
    expect(r.items[0].apply.ctimeIso).toBeUndefined()
    expect(r.items[0].changes[0].field).toBe('creation_time')
    expect(r.skipped).toHaveLength(0)
  })

  it('marks unchanged edits as skipped', () => {
    const r = buildEditsPlan([base], { 'C:/v/a.mp4': { mtimeMs: base.mtimeMs } }, isWin)
    expect(r.items).toHaveLength(0)
    expect(r.skipped[0].reason).toBe('NO_CHANGES')
  })

  it('drops ctime edits on non-Windows', () => {
    const r = buildEditsPlan(
      [base],
      { 'C:/v/a.mp4': { ctimeMs: new Date('2023-03-03T00:00:00Z').getTime() } },
      isWin
    )
    expect(r.items).toHaveLength(0)
  })

  it('writes ctime edits on Windows', () => {
    const r = buildEditsPlan(
      [base],
      { 'C:/v/a.mp4': { ctimeMs: new Date('2023-03-03T00:00:00Z').getTime() } },
      true
    )
    expect(r.items).toHaveLength(1)
    expect(r.items[0].apply.ctimeIso).toBe(new Date('2023-03-03T00:00:00Z').toISOString())
  })

  it('ignores files without edits', () => {
    const r = buildEditsPlan([base], {}, isWin)
    expect(r.items).toHaveLength(0)
    expect(r.skipped).toHaveLength(0)
  })
})
