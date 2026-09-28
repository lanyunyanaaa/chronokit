import { describe, expect, it } from 'vitest'
import { matchTargets, normalizeName, type MatchFacts } from '../matcher'

const f = (path: string, nameNoExt: string, size: number, durationSec?: number): MatchFacts => ({
  path,
  nameNoExt,
  size,
  durationSec
})

describe('normalizeName', () => {
  it('strips duplicate markers and codec noise', () => {
    expect(normalizeName('Beach Trip (1)')).toBe('beachtrip')
    expect(normalizeName('video_converted_1080p_x265')).toBe('video')
    expect(normalizeName('旅行视频 副本')).toBe('旅行视频')
  })
})

describe('matchTargets', () => {
  it('matches by normalized exact name across separators and noise', () => {
    const res = matchTargets(
      [f('/s/beach_trip.mp4', 'beach_trip', 1000)],
      [f('/t/Beach.Trip.converted.mp4', 'Beach.Trip.converted', 2000)]
    )
    expect(res).toHaveLength(1)
    expect(res[0].method).toBe('exact-name')
    expect(res[0].score).toBe(1)
  })

  it('matches by fuzzy name similarity', () => {
    const res = matchTargets(
      [f('/s/family_dinner.mp4', 'family_dinner', 1000)],
      [f('/t/family_dinner_2023.mp4', 'family_dinner_2023', 5000)],
      { threshold: 0.7 }
    )
    expect(res).toHaveLength(1)
    expect(res[0].method).toBe('fuzzy-name')
    expect(res[0].score).toBeGreaterThanOrEqual(0.7)
  })

  it('matches by duration when names differ', () => {
    const res = matchTargets(
      [f('/s/a.mp4', 'totally_different_name', 1000, 100.0)],
      [f('/t/b.mp4', 'another_odd_title', 999_000, 100.2)]
    )
    expect(res).toHaveLength(1)
    expect(res[0].method).toBe('duration')
  })

  it('does not match unrelated files', () => {
    const res = matchTargets(
      [f('/s/foo.mp4', 'foo', 1000)],
      [f('/t/bar.mp4', 'bar', 999_000)]
    )
    expect(res).toHaveLength(0)
  })

  it('respects the threshold for fuzzy matches', () => {
    const sources = [f('/s/family_dinner.mp4', 'family_dinner', 1000)]
    const targets = [f('/t/family_dinner_2023.mp4', 'family_dinner_2023', 5000)]
    expect(matchTargets(sources, targets, { threshold: 0.7 })).toHaveLength(1)
    expect(matchTargets(sources, targets, { threshold: 0.99 })).toHaveLength(0)
  })

  it('allows one source for many targets', () => {
    const sources = [f('/s/original.mp4', 'original', 1000)]
    const targets = [f('/t/original_copy1.mp4', 'original_copy1', 990), f('/t/original_copy2.mp4', 'original_copy2', 980)]
    const res = matchTargets(sources, targets)
    expect(res).toHaveLength(2)
    expect(res.every((r) => r.sourcePath === '/s/original.mp4')).toBe(true)
  })
})
