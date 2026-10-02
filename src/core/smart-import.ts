import { normalizeName } from './matcher'

export interface SmartFile {
  path: string
  name: string
  size: number
  mtimeMs: number
}

/** A resolved same-name pair: one source, one or more targets. */
export interface SmartPair {
  source: SmartFile
  targets: SmartFile[]
}

export interface SmartImportPlan {
  /** Groups with exactly 2 same-named files, auto-resolved by heuristic */
  pairs: SmartPair[]
  /** Groups with 3+ same-named files; the user must pick the source */
  ambiguous: SmartFile[][]
  /** Files without any same-named partner (added to the target list) */
  singletons: SmartFile[]
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * Pick which of two same-named files is the source (the one with correct
 * times). The original is usually the larger file — re-encodes and exports
 * shrink; on an exact tie the older file wins.
 */
function pickSource(a: SmartFile, b: SmartFile): SmartFile {
  if (a.size !== b.size) return a.size > b.size ? a : b
  return a.mtimeMs <= b.mtimeMs ? a : b
}

/**
 * Group files by normalized base name and classify each group:
 * - 1 file  -> singleton
 * - 2 files -> auto-resolved pair (heuristic source)
 * - 3+      -> ambiguous, sorted most-likely-source first for preselection
 */
export function analyzeSmartImport(files: SmartFile[]): SmartImportPlan {
  const seen = new Set<string>()
  const groups = new Map<string, SmartFile[]>()
  const singletons: SmartFile[] = []

  for (const f of files) {
    if (seen.has(f.path)) continue
    seen.add(f.path)
    const key = normalizeName(baseName(f.name))
    if (!key) {
      // name made entirely of noise tokens (codecs, "copy", …) — no safe key
      singletons.push(f)
      continue
    }
    const g = groups.get(key)
    if (g) g.push(f)
    else groups.set(key, [f])
  }

  const pairs: SmartPair[] = []
  const ambiguous: SmartFile[][] = []
  for (const g of groups.values()) {
    if (g.length === 1) {
      singletons.push(g[0])
    } else if (g.length === 2) {
      const source = pickSource(g[0], g[1])
      pairs.push({ source, targets: g.filter((f) => f !== source) })
    } else {
      ambiguous.push([...g].sort((a, b) => b.size - a.size || a.mtimeMs - b.mtimeMs))
    }
  }
  return { pairs, ambiguous, singletons }
}
