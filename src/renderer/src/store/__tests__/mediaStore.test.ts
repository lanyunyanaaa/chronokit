import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/services/ck', () => ({
  ck: {
    resolvePaths: vi.fn(async (paths: string[]) => paths),
    statFiles: vi.fn(async (paths: string[]) =>
      paths.map((p, i) => ({
        path: p,
        name: p.split(/[\\/]/).pop() ?? p,
        size: 100 + i,
        mtimeMs: 1000 + i,
        atimeMs: 1000 + i,
        birthtimeMs: 1000 + i
      }))
    ),
    probeFiles: vi.fn(async (paths: string[]) =>
      paths.map((p) => ({ path: p, size: 111, durationSec: 5, tags: {}, streams: [] }))
    )
  }
}))

import { useMediaStore } from '../mediaStore'
import { useMatchStore } from '../matchStore'

const SRC = 'C:\\media\\clip.mp4'
const TGT = 'D:\\backup\\clip.mp4'

function reset(): void {
  useMediaStore.setState({ items: {}, lists: { sources: [], targets: [], tools: [], checkup: [], table: [], rename: [] } })
  useMatchStore.setState({ pairs: {}, threshold: 0.75 })
}

beforeEach(reset)

describe('mediaStore', () => {
  it('addPaths probes items and fills results in', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    const s = useMediaStore.getState()
    expect(s.lists.sources).toEqual([SRC])
    expect(s.items[SRC]).toMatchObject({ name: 'clip.mp4', probing: false, durationSec: 5 })
  })

  it('addPaths dedupes already-listed paths', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    await useMediaStore.getState().addPaths('sources', [SRC])
    expect(useMediaStore.getState().lists.sources).toEqual([SRC])
  })

  it('one file shared across lists is stored once and stays until removed everywhere', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    await useMediaStore.getState().addPaths('tools', [SRC])
    expect(useMediaStore.getState().lists.tools).toEqual([SRC])

    useMediaStore.getState().removePaths('sources', [SRC])
    expect(useMediaStore.getState().items[SRC]).toBeDefined()

    useMediaStore.getState().clearKind('tools')
    expect(useMediaStore.getState().items[SRC]).toBeUndefined()
  })
})

describe('mediaStore ↔ matchStore integration', () => {
  it('auto-matches same-name source/target after both lists are filled', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    await useMediaStore.getState().addPaths('targets', [TGT])
    const pairs = useMatchStore.getState().pairs
    expect(Object.keys(pairs)).toContain(TGT)
    expect(pairs[TGT]).toMatchObject({ sourcePath: SRC, method: 'exact-name' })
  })

  it('autoMatch:false skips pairing', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC], { autoMatch: false })
    await useMediaStore.getState().addPaths('targets', [TGT], { autoMatch: false })
    expect(useMatchStore.getState().pairs).toEqual({})
  })

  it('removing a target prunes its pair and the orphaned item', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    await useMediaStore.getState().addPaths('targets', [TGT])
    useMediaStore.getState().removePaths('targets', [TGT])
    expect(useMatchStore.getState().pairs).toEqual({})
    expect(useMediaStore.getState().items[TGT]).toBeUndefined()
    expect(useMediaStore.getState().items[SRC]).toBeDefined()
  })

  it('clearing either side prunes stale pairs', async () => {
    await useMediaStore.getState().addPaths('sources', [SRC])
    await useMediaStore.getState().addPaths('targets', [TGT])
    useMediaStore.getState().clearKind('sources')
    expect(useMatchStore.getState().pairs).toEqual({})
  })

  it('rebind sets a manual pair; rebinding to null removes it', () => {
    const { rebind } = useMatchStore.getState()
    rebind(TGT, SRC)
    expect(useMatchStore.getState().pairs[TGT]).toMatchObject({ sourcePath: SRC, method: 'manual' })
    rebind(TGT, null)
    expect(useMatchStore.getState().pairs[TGT]).toBeUndefined()
  })
})
