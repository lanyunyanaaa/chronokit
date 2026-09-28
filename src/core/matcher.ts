import type { MatchMethod } from '../shared/index'

export interface MatchFacts {
  path: string
  nameNoExt: string
  size: number
  durationSec?: number
}

export interface MatchOptions {
  threshold?: number
}

export const DEFAULT_MATCH_THRESHOLD = 0.75

const STOPWORDS = new Set([
  'copy', '副本', 'converted', '转码', 'new', '新', 'final', 'x264', 'x265',
  'h264', 'h265', 'hevc', 'avc', 'aac', 'mp4', 'mkv', 'avi', 'mov', 'wmv',
  'flv', 'webm', '4k', '8k', 'hd', 'uhd', 'bluray', 'web', 'dl', 'hdr', '10bit'
])

/**
 * Normalize a filename for comparison: lowercase, strip duplicate markers
 * like " (1)", drop codec/resolution noise tokens, collapse separators.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(\d+\)\s*$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d{3,4}p$/.test(w))
    .join('')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a).slice(0, 64)
  const nb = normalizeName(b).slice(0, 64)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const dist = levenshtein(na, nb)
  return 1 - dist / Math.max(na.length, nb.length)
}

function sizeSimilarity(a: number, b: number): number {
  const max = Math.max(a, b)
  if (max <= 0) return 0
  return 1 - Math.abs(a - b) / max
}

function durationSimilarity(a?: number, b?: number): number {
  if (!a || !b || a <= 0 || b <= 0) return 0
  return 1 - Math.abs(a - b) / Math.max(a, b)
}

export interface MatchResult {
  targetPath: string
  sourcePath: string
  method: MatchMethod
  score: number
}

/**
 * Match each target to its best source. Dimensions are scored independently
 * and the strongest wins, so every pair is explainable:
 * - exact normalized filename -> score 1 (always accepted)
 * - fuzzy filename similarity >= 0.62
 * - size similarity >= 0.90
 * - duration similarity >= 0.95
 * The final result is filtered by `threshold` (except exact names).
 * Sources may be reused across targets (one original, many exports).
 */
export function matchTargets(
  sources: MatchFacts[],
  targets: MatchFacts[],
  opts: MatchOptions = {}
): MatchResult[] {
  const threshold = opts.threshold ?? DEFAULT_MATCH_THRESHOLD
  const results: MatchResult[] = []

  for (const t of targets) {
    let best: { source: MatchFacts; method: MatchMethod; score: number } | null = null

    for (const s of sources) {
      if (s.path === t.path) continue

      let candidate: { method: MatchMethod; score: number } | null = null
      const nScore = nameSimilarity(t.nameNoExt, s.nameNoExt)
      if (nScore === 1) candidate = { method: 'exact-name', score: 1 }
      else if (nScore >= 0.62) candidate = { method: 'fuzzy-name', score: nScore }

      const sScore = sizeSimilarity(t.size, s.size)
      if (sScore >= 0.9 && (!candidate || sScore > candidate.score)) {
        candidate = { method: 'size', score: sScore }
      }

      const dScore = durationSimilarity(t.durationSec, s.durationSec)
      if (dScore >= 0.95 && (!candidate || dScore > candidate.score)) {
        candidate = { method: 'duration', score: dScore }
      }

      if (candidate && (!best || candidate.score > best.score)) {
        best = { source: s, method: candidate.method, score: candidate.score }
      }
    }

    if (best && (best.method === 'exact-name' || best.score >= threshold)) {
      results.push({
        targetPath: t.path,
        sourcePath: best.source.path,
        method: best.method,
        score: Math.round(best.score * 1000) / 1000
      })
    }
  }
  return results
}
