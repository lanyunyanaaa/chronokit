import { describe, expect, it } from 'vitest'
import {
  buildIssuePlan,
  isPlaceholderTime,
  runCheckup,
  type CheckupFacts
} from '../checkup'
import { formatLocal } from '../time-engine'

function facts(overrides: Partial<CheckupFacts> & { path: string; name: string }): CheckupFacts {
  return {
    size: 1024,
    mtimeMs: new Date('2023-06-15T10:30:00Z').getTime(),
    birthtimeMs: new Date('2023-06-15T10:00:00Z').getTime(),
    ...overrides
  }
}

const MD = '2023-01-01T04:00:00Z' // metadata creation time
const FN = '2023-01-01T04:00:00Z' // filename time (same by default)

function clean(name: string, i = 0): CheckupFacts {
  // each file one hour apart so a "clean" batch has distinct, consistent times
  const t = new Date(new Date('2023-01-01T04:00:00Z').getTime() + i * 3600_000).toISOString()
  return facts({
    path: `C:\\v\\${name}.mp4`,
    name: `${name}.mp4`,
    creationTimeIso: t,
    filenameTimeIso: t,
    durationSec: 60 + i
  })
}

describe('isPlaceholderTime', () => {
  it('flags 1900-1904 and epoch-adjacent stamps', () => {
    expect(isPlaceholderTime(new Date('1900-01-01T00:00:00Z'))).toBe(true)
    expect(isPlaceholderTime(new Date('1904-06-01T00:00:00Z'))).toBe(true)
    expect(isPlaceholderTime(new Date('1970-01-01T00:00:20Z'))).toBe(true)
    expect(isPlaceholderTime(new Date('1969-12-31T23:00:00Z'))).toBe(true)
    expect(isPlaceholderTime(new Date('2023-01-01T04:00:00Z'))).toBe(false)
    expect(isPlaceholderTime(new Date('1972-03-01T00:00:00Z'))).toBe(false)
  })
})

describe('runCheckup', () => {
  it('reports a clean batch as healthy', () => {
    const r = runCheckup([clean('a'), clean('b', 1), clean('c', 2)])
    expect(r.issues).toHaveLength(0)
    expect(r.counts).toMatchObject({ healthy: 3, total: 3, error: 0, warn: 0, info: 0 })
  })

  it('R1: missing or placeholder metadata with filename time offers a filename fix', () => {
    const r = runCheckup([
      facts({ path: 'C:\\v\\a.mp4', name: 'a.mp4', filenameTimeIso: FN }),
      facts({
        path: 'C:\\v\\b.mp4',
        name: 'b.mp4',
        creationTimeIso: '1970-01-01T00:00:10Z',
        filenameTimeIso: '2023-02-02T08:00:00Z'
      }),
      facts({ path: 'C:\\v\\c.mp4', name: 'c.mp4', creationTimeIso: '1900-01-01T00:00:00Z' })
    ])
    const r1 = r.issues.filter((i) => i.rule === 'R1')
    expect(r1).toHaveLength(3)
    expect(r1[0].severity).toBe('error')
    expect(r1[0].fix?.kind).toBe('filename')
    // no filename time -> no auto fix
    expect(r1[2].fix).toBeUndefined()
  })

  it('R2: filename vs metadata conflict beyond tolerance (single file)', () => {
    const r = runCheckup([
      clean('a'),
      clean('b', 1),
      facts({
        path: 'C:\\v\\x.mp4',
        name: 'x.mp4',
        creationTimeIso: '2023-01-01T04:00:00Z',
        filenameTimeIso: '2023-01-01T15:00:00Z' // 11h apart, only 2 files w/ both -> no R6
      })
    ])
    const r2 = r.issues.filter((i) => i.rule === 'R2')
    expect(r2).toHaveLength(1)
    expect(r2[0].paths).toEqual(['C:\\v\\x.mp4'])
    expect(r2[0].severity).toBe('warn')
  })

  it('R6: a consistent batch-wide offset is diagnosed once and suppresses R2', () => {
    const mk = (name: string, fnIso: string): CheckupFacts =>
      facts({
        path: `C:\\v\\${name}.mp4`,
        name: `${name}.mp4`,
        filenameTimeIso: fnIso,
        // metadata is filename + 8h (camera clock / timezone)
        creationTimeIso: new Date(new Date(fnIso).getTime() + 8 * 3600_000).toISOString()
      })
    const r = runCheckup([
      mk('a', '2023-01-01T02:00:00Z'),
      mk('b', '2023-01-01T03:30:00Z'),
      mk('c', '2023-01-01T09:10:00Z'),
      clean('z') // healthy bystander
    ])
    expect(r.issues.filter((i) => i.rule === 'R2')).toHaveLength(0)
    const r6 = r.issues.filter((i) => i.rule === 'R6')
    expect(r6).toHaveLength(1)
    expect(r6[0].paths).toHaveLength(3)
    expect(r6[0].params?.offset).toBe('+8h')
    expect(r6[0].fix).toMatchObject({ kind: 'shift', hours: -8, minutes: 0 })
  })

  it('R6: half-hour timezone offsets produce signed hour+minute fix', () => {
    const mk = (name: string, fnIso: string): CheckupFacts =>
      facts({
        path: `C:\\v\\${name}.mp4`,
        name: `${name}.mp4`,
        filenameTimeIso: fnIso,
        creationTimeIso: new Date(new Date(fnIso).getTime() + 5.5 * 3600_000).toISOString()
      })
    const r = runCheckup([
      mk('a', '2023-01-01T02:00:00Z'),
      mk('b', '2023-01-01T03:30:00Z'),
      mk('c', '2023-01-01T09:10:00Z')
    ])
    const r6 = r.issues.find((i) => i.rule === 'R6')!
    expect(r6.params?.offset).toBe('+5:30h')
    expect(r6.fix).toMatchObject({ hours: -5, minutes: -30 })
  })

  it('R4: three files sharing one identical metadata stamp are flagged as a group', () => {
    const stamp = '2023-05-05T05:05:05Z'
    const r = runCheckup([
      facts({ path: 'C:\\v\\a.mp4', name: 'a.mp4', creationTimeIso: stamp }),
      facts({ path: 'C:\\v\\b.mp4', name: 'b.mp4', creationTimeIso: stamp }),
      facts({ path: 'C:\\v\\c.mp4', name: 'c.mp4', creationTimeIso: stamp }),
      clean('z')
    ])
    const r4 = r.issues.filter((i) => i.rule === 'R4')
    expect(r4).toHaveLength(1)
    expect(r4[0].paths).toHaveLength(3)
    expect(r4[0].severity).toBe('error')
  })

  it('R5: filename order monotonic but metadata scrambled', () => {
    const mk = (name: string, fnIso: string, mdIso: string): CheckupFacts =>
      facts({
        path: `C:\\v\\${name}.mp4`,
        name: `${name}.mp4`,
        filenameTimeIso: fnIso,
        creationTimeIso: mdIso
      })
    const r = runCheckup([
      mk('IMG_0001', '2023-01-01T01:00:00Z', '2023-01-01T04:00:00Z'),
      mk('IMG_0002', '2023-01-01T02:00:00Z', '2023-01-01T02:00:00Z'),
      mk('IMG_0003', '2023-01-01T03:00:00Z', '2023-01-01T07:00:00Z'),
      mk('IMG_0004', '2023-01-01T04:00:00Z', '2023-01-01T01:00:00Z')
    ])
    const r5 = r.issues.filter((i) => i.rule === 'R5')
    expect(r5).toHaveLength(1)
    expect(r5[0].paths).toHaveLength(4)
    expect(r5[0].fix?.kind).toBe('filename')
  })

  it('R5: does not fire when filename times carry no order signal', () => {
    const t = '2023-01-01T04:00:00Z'
    const r = runCheckup(
      ['a', 'b', 'c'].map((n, i) =>
        facts({
          path: `C:\\v\\${n}.mp4`,
          name: `${n}.mp4`,
          filenameTimeIso: t, // all identical -> no monotonic signal
          creationTimeIso: i === 1 ? '2023-01-05T00:00:00Z' : t
        })
      )
    )
    expect(r.issues.filter((i) => i.rule === 'R5')).toHaveLength(0)
  })

  it('R7: unreadable probe, zero-byte and broken-duration files are errors', () => {
    const r = runCheckup([
      facts({ path: 'C:\\v\\a.mp4', name: 'a.mp4', probeFailed: true }),
      facts({ path: 'C:\\v\\b.mp4', name: 'b.mp4', size: 0 }),
      facts({
        path: 'C:\\v\\c.mp4',
        name: 'c.mp4',
        durationSec: 0,
        creationTimeIso: MD,
        filenameTimeIso: FN
      })
    ])
    expect(r.issues.filter((i) => i.rule === 'R7')).toHaveLength(3)
    expect(r.counts.error).toBe(3)
  })

  it('R3: birthtime later than mtime is an info-level copy-over sign', () => {
    const r = runCheckup([
      facts({
        path: 'C:\\v\\a.mp4',
        name: 'a.mp4',
        mtimeMs: new Date('2023-01-01T04:00:00Z').getTime(),
        birthtimeMs: new Date('2023-02-01T04:00:00Z').getTime(), // copied a month later
        creationTimeIso: MD,
        filenameTimeIso: FN
      })
    ])
    const r3 = r.issues.filter((i) => i.rule === 'R3')
    expect(r3).toHaveLength(1)
    expect(r3[0].severity).toBe('info')
  })

  it('skips files still probing', () => {
    const r = runCheckup([facts({ path: 'C:\\v\\a.mp4', name: 'a.mp4', probing: true })])
    expect(r.issues).toHaveLength(0)
    expect(r.counts.total).toBe(0)
  })

  it('sorts issues error-first, then by rule', () => {
    const r = runCheckup([
      facts({
        path: 'C:\\v\\a.mp4',
        name: 'a.mp4',
        creationTimeIso: MD,
        mtimeMs: new Date('2023-01-01T04:00:00Z').getTime(),
        birthtimeMs: new Date('2023-02-01T04:00:00Z').getTime(),
        filenameTimeIso: '2023-01-01T15:00:00Z' // R2 (single file)
      }),
      facts({ path: 'C:\\v\\b.mp4', name: 'b.mp4', probeFailed: true })
    ])
    expect(r.issues.map((i) => i.rule)).toEqual(['R7', 'R2', 'R3'])
  })
})

describe('buildIssuePlan', () => {
  const ctx = { isWin: false, opts: { metadata: true, mtime: true, ctime: false } }

  it('filename fix builds from-filename plans for the issue paths', () => {
    const issue = {
      rule: 'R1' as const,
      severity: 'error' as const,
      messageKey: 'checkup.r1.desc',
      paths: ['C:\\v\\a.mp4'],
      fix: { kind: 'filename' as const }
    }
    const factsIn: CheckupFacts[] = [
      facts({
        path: 'C:\\v\\a.mp4',
        name: 'a.mp4',
        filenameTimeIso: '2023-03-03T10:00:00Z',
        mtimeMs: new Date('2023-01-01T00:00:00Z').getTime(),
        birthtimeMs: new Date('2023-01-01T00:00:00Z').getTime()
      })
    ]
    const plan = buildIssuePlan(issue, factsIn, ctx)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].apply.metadata).toBeDefined()
    expect(plan.items[0].apply.mtimeMs).toBe(new Date('2023-03-03T10:00:00Z').getTime())
  })

  it('shift fix moves metadata back by the detected offset', () => {
    const issue = {
      rule: 'R6' as const,
      severity: 'warn' as const,
      messageKey: 'checkup.r6.desc',
      params: { offset: '+8h' },
      paths: ['C:\\v\\a.mp4'],
      fix: { kind: 'shift' as const, hours: -8, minutes: 0 }
    }
    const factsIn: CheckupFacts[] = [
      facts({
        path: 'C:\\v\\a.mp4',
        name: 'a.mp4',
        creationTimeIso: '2023-01-01T12:00:00Z',
        filenameTimeIso: '2023-01-01T04:00:00Z',
        mtimeMs: new Date('2023-01-01T12:00:00Z').getTime(),
        birthtimeMs: new Date('2023-01-01T12:00:00Z').getTime()
      })
    ]
    const plan = buildIssuePlan(issue, factsIn, ctx)
    expect(plan.items).toHaveLength(1)
    // metadata 12:00Z shifted -8h -> 04:00Z (== filename time); display is local
    expect(plan.items[0].changes[0].field).toBe('creation_time')
    expect(plan.items[0].changes[0].to).toBe(
      formatLocal(new Date('2023-01-01T04:00:00Z'))
    )
  })

  it('ctime fix writes only the creation time, from metadata or filename', () => {
    const issue = {
      rule: 'R3' as const,
      severity: 'info' as const,
      messageKey: 'checkup.r3.desc',
      paths: ['C:\\v\\a.mp4', 'C:\\v\\b.mp4'],
      fix: { kind: 'ctime' as const }
    }
    const factsIn: CheckupFacts[] = [
      facts({
        path: 'C:\\v\\a.mp4',
        name: 'a.mp4',
        creationTimeIso: MD,
        mtimeMs: new Date('2023-01-01T04:00:00Z').getTime(),
        birthtimeMs: new Date('2023-06-01T00:00:00Z').getTime()
      }),
      facts({
        path: 'C:\\v\\b.mp4',
        name: 'b.mp4',
        filenameTimeIso: '2023-01-02T09:30:00Z',
        mtimeMs: new Date('2023-01-02T09:30:00Z').getTime(),
        birthtimeMs: new Date('2023-06-01T00:00:00Z').getTime()
      })
    ]
    const plan = buildIssuePlan(issue, factsIn, ctx)
    expect(plan.items).toHaveLength(2)
    for (const it of plan.items) {
      expect(it.apply.ctimeIso).toBeDefined()
      expect(it.apply.metadata).toBeUndefined()
      expect(it.apply.mtimeMs).toBeUndefined()
    }
    expect(plan.items[0].timeSource).toBe('metadata')
    expect(plan.items[1].timeSource).toBe('filename')
  })

  it('issues without a fix produce an empty plan', () => {
    const issue = {
      rule: 'R7' as const,
      severity: 'error' as const,
      messageKey: 'checkup.r7.desc',
      paths: ['C:\\v\\a.mp4']
    }
    const plan = buildIssuePlan(issue, [], ctx)
    expect(plan.items).toHaveLength(0)
  })
})
