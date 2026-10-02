import { describe, expect, it } from 'vitest'
import { buildRenamePlan, renderStamp, type RenameFacts } from '../rename'

function fact(name: string, mdIso: string | null = '2023-01-01T04:00:00Z'): RenameFacts {
  return {
    path: `C:/v/${name}`,
    name,
    creationTimeIso: mdIso,
    filenameTimeIso: null,
    mtimeMs: new Date(mdIso ?? '2023-06-01T00:00:00Z').getTime()
  }
}

describe('renderStamp', () => {
  it('renders both stamp patterns in local time', () => {
    const d = new Date(2023, 0, 1, 12, 3, 5) // local
    expect(renderStamp(d, 'stamp')).toBe('20230101_120305')
    expect(renderStamp(d, 'stamp-dash')).toBe('2023-01-01_120305')
  })
})

describe('buildRenamePlan', () => {
  it('renames to stamp.ext using the metadata time by default', () => {
    const plan = buildRenamePlan([fact('mmexport123.mp4')], {
      pattern: 'stamp',
      prefix: '',
      suffix: '',
      conflict: 'skip'
    })
    expect(plan.renames).toHaveLength(1)
    expect(plan.renames[0].to).toMatch(/^\d{8}_\d{6}\.mp4$/)
    expect(plan.skipped).toHaveLength(0)
  })

  it('date-prefix keeps the original stem', () => {
    const plan = buildRenamePlan([fact('holiday.mp4')], {
      pattern: 'date-prefix',
      prefix: '',
      suffix: '',
      conflict: 'skip'
    })
    expect(plan.renames[0].to).toMatch(/^\d{8}_\d{6}_holiday\.mp4$/)
  })

  it('prefix and suffix wrap the stamp', () => {
    const plan = buildRenamePlan([fact('a.mp4')], {
      pattern: 'stamp',
      prefix: 'VID_',
      suffix: '_cam',
      conflict: 'skip'
    })
    expect(plan.renames[0].to).toMatch(/^VID_\d{8}_\d{6}_cam\.mp4$/)
  })

  it('skips files without any usable time', () => {
    const plan = buildRenamePlan(
      [{ path: 'C:/v/x.mp4', name: 'x.mp4', creationTimeIso: null, filenameTimeIso: null, mtimeMs: NaN }],
      { pattern: 'stamp', prefix: '', suffix: '', conflict: 'skip' }
    )
    expect(plan.renames).toHaveLength(0)
    expect(plan.skipped[0].reason).toBe('NO_TIME')
  })

  it('skips files whose target equals their current name', () => {
    const d = new Date(2023, 0, 1, 12, 3, 5)
    const iso = d.toISOString() // encodes the same instant; renderStamp is local
    const plan = buildRenamePlan([fact('20230101_120305.mp4', iso)], {
      pattern: 'stamp',
      prefix: '',
      suffix: '',
      conflict: 'skip'
    })
    expect(plan.renames).toHaveLength(0)
    expect(plan.skipped[0].reason).toBe('UNCHANGED')
  })

  it('conflict=skip skips names that are already taken', () => {
    const plan = buildRenamePlan([fact('a.mp4'), fact('b.mp4')], {
      pattern: 'stamp',
      prefix: '',
      suffix: '',
      conflict: 'skip'
    })
    // both resolve to the same stamp; the second is a collision
    expect(plan.renames).toHaveLength(1)
    expect(plan.skipped).toHaveLength(1)
  })

  it('conflict=sequence numbers collisions and reserves them', () => {
    const plan = buildRenamePlan([fact('a.mp4'), fact('b.mp4'), fact('c.mp4')], {
      pattern: 'stamp',
      prefix: '',
      suffix: '',
      conflict: 'sequence'
    })
    expect(plan.renames).toHaveLength(3)
    const targets = plan.renames.map((r) => r.to).sort()
    expect(targets[0]).toMatch(/-001\.mp4$/)
    expect(targets[1]).toMatch(/-002\.mp4$/)
  })

  it('respects names taken outside the batch (case-insensitive)', () => {
    // the file resolves to its metadata time -> this stamp (local rendering)
    const stamp = renderStamp(new Date('2023-01-01T04:00:00Z'), 'stamp')
    const plan = buildRenamePlan(
      [fact('a.mp4')],
      { pattern: 'stamp', prefix: '', suffix: '', conflict: 'sequence' },
      [`${stamp}.MP4`]
    )
    expect(plan.renames[0].to).toBe(`${stamp}-001.mp4`)
  })

  it('prefers filename time over filesystem time via the source chain', () => {
    const f: RenameFacts = {
      path: 'C:/v/VID_20230101_120305.mp4',
      name: 'VID_20230101_120305.mp4',
      creationTimeIso: null,
      filenameTimeIso: '2023-01-01T04:00:00Z',
      mtimeMs: new Date('2023-06-01T00:00:00Z').getTime()
    }
    const plan = buildRenamePlan([f], { pattern: 'stamp', prefix: '', suffix: '', conflict: 'skip' })
    // local rendering of 04:00Z depends on TZ; just assert it used the filename hour
    const d = new Date('2023-01-01T04:00:00Z')
    const expectStamp = renderStamp(d, 'stamp')
    expect(plan.renames[0].to).toBe(`${expectStamp}.mp4`)
  })
})
