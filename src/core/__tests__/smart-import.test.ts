import { describe, expect, it } from 'vitest'
import { analyzeSmartImport, type SmartFile } from '../smart-import'

function f(path: string, size = 100, mtimeMs = 1_000): SmartFile {
  return { path, name: path.split(/[\\/]/).pop()!, size, mtimeMs }
}

describe('analyzeSmartImport', () => {
  it('pairs two same-named files and picks the larger one as source', () => {
    const plan = analyzeSmartImport([
      f('D:/media/video.mov', 50_000),
      f('D:/export/video.mp4', 20_000)
    ])
    expect(plan.pairs).toHaveLength(1)
    expect(plan.pairs[0].source.path).toBe('D:/media/video.mov')
    expect(plan.pairs[0].targets.map((t) => t.path)).toEqual(['D:/export/video.mp4'])
    expect(plan.ambiguous).toHaveLength(0)
    expect(plan.singletons).toHaveLength(0)
  })

  it('falls back to older mtime when sizes are equal', () => {
    const plan = analyzeSmartImport([
      f('D:/a/holiday.mp4', 100, 2_000),
      f('D:/b/holiday.mp4', 100, 1_000)
    ])
    expect(plan.pairs[0].source.path).toBe('D:/b/holiday.mp4')
  })

  it('normalizes copy markers and codec noise into one group', () => {
    const plan = analyzeSmartImport([
      f('D:/x/Beach Trip (1).mp4', 10),
      f('D:/y/beach_trip x265.mp4', 30)
    ])
    expect(plan.pairs).toHaveLength(1)
    expect(plan.singletons).toHaveLength(0)
  })

  it('treats groups of 3+ as ambiguous, sorted by size desc', () => {
    const plan = analyzeSmartImport([
      f('D:/v/clip.mp4', 10),
      f('D:/w/clip.mov', 90),
      f('D:/z/clip.mkv', 50)
    ])
    expect(plan.pairs).toHaveLength(0)
    expect(plan.ambiguous).toHaveLength(1)
    expect(plan.ambiguous[0].map((x) => x.size)).toEqual([90, 50, 10])
  })

  it('collects files without a same-named partner as singletons', () => {
    const plan = analyzeSmartImport([
      f('D:/v/clip.mp4', 10),
      f('D:/v/clip.mov', 20),
      f('D:/v/other.mp4', 30),
      f('D:/v/another.mkv', 40)
    ])
    expect(plan.pairs).toHaveLength(1)
    expect(plan.singletons.map((s) => s.name).sort()).toEqual(['another.mkv', 'other.mp4'])
  })

  it('dedupes identical paths', () => {
    const plan = analyzeSmartImport([f('D:/v/clip.mp4', 10), f('D:/v/clip.mp4', 10)])
    expect(plan.singletons).toHaveLength(1)
    expect(plan.pairs).toHaveLength(0)
  })

  it('routes noise-only names to singletons instead of grouping them', () => {
    const plan = analyzeSmartImport([f('D:/v/final.mp4', 10), f('D:/w/final.mkv', 20)])
    expect(plan.pairs).toHaveLength(0)
    expect(plan.ambiguous).toHaveLength(0)
    expect(plan.singletons).toHaveLength(2)
  })
})
