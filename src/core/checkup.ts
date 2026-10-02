import type { BuildPlanResult, PlanItem, PlanFieldChange } from '../shared/index'
import { buildToolPlan, type PlanFileFacts, type SyncOptions } from './plan'
import { formatLocal } from './time-engine'

/**
 * Checkup engine (体检中心): runs the R1-R7 rule set over a scanned batch of
 * media files and produces a report of grouped issues. Pure & testable —
 * every fix maps onto the existing plan → dry-run → execute → undo pipeline,
 * so checkup never writes files itself.
 */

export type CheckupRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7'
export type CheckupSeverity = 'error' | 'warn' | 'info'

/** Fix strategies; each maps to an existing plan builder. */
export type CheckupFixKind = 'filename' | 'shift' | 'ctime'

export interface CheckupFix {
  kind: CheckupFixKind
  /** For 'shift': the delta to apply (hours/minutes), pre-filled for the user. */
  hours?: number
  minutes?: number
}

export interface CheckupIssue {
  rule: CheckupRule
  severity: CheckupSeverity
  /** i18n key under `checkup.r*.`, rendered with `params`. */
  messageKey: string
  params?: Record<string, string | number>
  paths: string[]
  fix?: CheckupFix
}

export interface CheckupReport {
  issues: CheckupIssue[]
  counts: { error: number; warn: number; info: number; healthy: number; total: number }
}

export interface CheckupFacts {
  path: string
  name: string
  size: number
  mtimeMs: number
  birthtimeMs: number
  durationSec?: number
  creationTimeIso?: string
  filenameTimeIso?: string
  probing?: boolean
  probeFailed?: boolean
}

export interface CheckupOptions {
  /** R2 filename-vs-metadata tolerance in minutes (default 60). */
  toleranceMin?: number
  /** R6 requires at least this many files sharing one consistent offset. */
  minBatch?: number
}

const MIN = 60_000
/** Slack so that equal-ish instants / sub-second jitter don't trip rules. */
const TIE_MS = 90_000

function parseIso(iso?: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Camera/container placeholder stamps around 1900/1970 mean "no real time". */
export function isPlaceholderTime(d: Date): boolean {
  const y = d.getUTCFullYear()
  return y <= 1904 || y === 1969 || (y === 1970 && d.getTime() < 2 * 24 * 3600_000)
}

function effectiveMetadata(f: CheckupFacts): Date | null {
  const d = parseIso(f.creationTimeIso)
  if (!d || isPlaceholderTime(d)) return null
  return d
}

const SEVERITY_ORDER: Record<CheckupSeverity, number> = { error: 0, warn: 1, info: 2 }

/**
 * Run all rules. Rules are batch-aware: R4/R5/R6 evaluate the batch as a
 * whole and emit one grouped issue; R6 suppresses R2 for files it explains
 * (a consistent timezone offset is a better diagnosis than N conflicts).
 */
export function runCheckup(files: CheckupFacts[], opts?: CheckupOptions): CheckupReport {
  const toleranceMin = opts?.toleranceMin ?? 60
  const minBatch = opts?.minBatch ?? 3
  const done = files.filter((f) => !f.probing)
  const issues: CheckupIssue[] = []

  // ---- R6 first: consistent hour-level offset (suspected timezone) ----
  const r6Paths: string[] = []
  {
    const withBoth = done
      .map((f) => ({ f, md: effectiveMetadata(f), fn: parseIso(f.filenameTimeIso) }))
      .filter((x): x is { f: CheckupFacts; md: Date; fn: Date } => x.md !== null && x.fn !== null)
      .map((x) => ({ ...x, diff: x.md.getTime() - x.fn.getTime() }))
    if (withBoth.length >= minBatch) {
      const sorted = [...withBoth].sort((a, b) => a.diff - b.diff)
      const median = sorted[Math.floor(sorted.length / 2)].diff
      const consistent = withBoth.filter((x) => Math.abs(x.diff - median) <= 2 * MIN)
      const abs = Math.abs(median)
      if (consistent.length >= minBatch && abs >= 30 * MIN) {
        // moving metadata to filename time means applying -(median offset);
        // minutes keep the sign of the remainder so hours/minutes compose
        const fixMs = -median
        const hours = Math.trunc(fixMs / 3600_000)
        const minutes = Math.round((fixMs % 3600_000) / MIN) || 0
        r6Paths.push(...consistent.map((x) => x.f.path))
        issues.push({
          rule: 'R6',
          severity: 'warn',
          messageKey: 'checkup.r6.desc',
          params: {
            n: consistent.length,
            offset: formatOffset(median)
          },
          paths: r6Paths,
          fix: { kind: 'shift', hours, minutes }
        })
      }
    }
  }

  const perFile = (rule: CheckupRule, severity: CheckupSeverity, messageKey: string, f: CheckupFacts, params?: Record<string, string | number>): void => {
    issues.push({ rule, severity, messageKey, params, paths: [f.path] })
  }

  for (const f of done) {
    const md = effectiveMetadata(f)
    const fn = parseIso(f.filenameTimeIso)

    // ---- R7: unreadable / zero bytes / broken duration ----
    if (f.probeFailed || f.size === 0 || (f.durationSec != null && f.durationSec <= 0)) {
      perFile('R7', 'error', 'checkup.r7.desc', f)
      continue
    }

    // ---- R1: metadata creation_time missing or placeholder ----
    if (!md) {
      const hasFn = fn !== null
      issues.push({
        rule: 'R1',
        severity: 'error',
        messageKey: 'checkup.r1.desc',
        paths: [f.path],
        ...(hasFn ? { fix: { kind: 'filename' } as CheckupFix } : {})
      })
      continue
    }

    // ---- R2: filename vs metadata conflict (suppressed when R6 explains it) ----
    if (fn && !r6Paths.includes(f.path) && Math.abs(md.getTime() - fn.getTime()) > toleranceMin * MIN) {
      perFile('R2', 'warn', 'checkup.r2.desc', f)
    }

    // ---- R3: NTFS creation time later than modification time (copy-over sign) ----
    if (f.birthtimeMs > f.mtimeMs + 2000) {
      perFile('R3', 'info', 'checkup.r3.desc', f)
    }
  }

  // ---- R4: same-batch files sharing one identical metadata time ----
  {
    const byStamp = new Map<string, string[]>()
    for (const f of done) {
      const md = effectiveMetadata(f)
      if (!md) continue
      const key = md.toISOString()
      byStamp.set(key, [...(byStamp.get(key) ?? []), f.path])
    }
    for (const [stamp, paths] of byStamp) {
      if (paths.length >= minBatch) {
        issues.push({
          rule: 'R4',
          severity: 'error',
          messageKey: 'checkup.r4.desc',
          params: { n: paths.length, time: formatLocal(new Date(stamp)) },
          paths,
          fix: { kind: 'filename' }
        })
      }
    }
  }

  // ---- R5: filename times monotonic but metadata disordered ----
  {
    const withBoth = done
      .map((f) => ({ f, md: effectiveMetadata(f), fn: parseIso(f.filenameTimeIso) }))
      .filter((x): x is { f: CheckupFacts; md: Date; fn: Date } => x.md !== null && x.fn !== null)
      .sort((a, b) => a.f.name.localeCompare(b.f.name, undefined, { numeric: true }))
    if (withBoth.length >= minBatch) {
      const distinct = new Set(withBoth.map((x) => Math.round(x.fn.getTime() / TIE_MS)))
      let inversions = 0
      for (let i = 0; i < withBoth.length - 1; i++) {
        if (withBoth[i].md.getTime() > withBoth[i + 1].md.getTime() + 60_000) inversions++
      }
      const monotonicFn = withBoth.every(
        (x, i) => i === 0 || x.fn.getTime() >= withBoth[i - 1].fn.getTime() - TIE_MS
      )
      if (monotonicFn && distinct.size >= 2 && inversions > 0) {
        issues.push({
          rule: 'R5',
          severity: 'warn',
          messageKey: 'checkup.r5.desc',
          params: { n: withBoth.length },
          paths: withBoth.map((x) => x.f.path),
          fix: { kind: 'filename' }
        })
      }
    }
  }

  const affected = new Set(issues.flatMap((i) => i.paths))
  issues.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.rule.localeCompare(b.rule)
  )

  return {
    issues,
    counts: {
      error: issues.filter((i) => i.severity === 'error').length,
      warn: issues.filter((i) => i.severity === 'warn').length,
      info: issues.filter((i) => i.severity === 'info').length,
      healthy: done.length - affected.size,
      total: done.length
    }
  }
}

function formatOffset(ms: number): string {
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3600_000)
  const m = Math.round((abs - h * 3600_000) / MIN)
  const body = m > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${h}`
  return `${ms > 0 ? '+' : '-'}${body}h`
}

export interface CheckupPlanContext {
  isWin: boolean
  opts: SyncOptions
}

/**
 * Build the concrete dry-run plan for one issue. Every fix lands in the
 * same plan → preview → execute → journal → undo pipeline the rest of the
 * app uses.
 */
export function buildIssuePlan(
  issue: CheckupIssue,
  facts: PlanFileFacts[],
  ctx: CheckupPlanContext
): BuildPlanResult {
  const byPath = new Map(facts.map((f) => [f.path, f]))
  const scoped = issue.paths.flatMap((p) => (byPath.has(p) ? [byPath.get(p)!] : []))

  if (issue.fix?.kind === 'filename') {
    return buildToolPlan(scoped, { mode: 'filename' }, ctx.opts, ctx.isWin)
  }
  if (issue.fix?.kind === 'shift') {
    return buildToolPlan(
      scoped,
      { mode: 'shift', shift: { hours: issue.fix.hours ?? 0, minutes: issue.fix.minutes ?? 0 } },
      ctx.opts,
      ctx.isWin
    )
  }
  if (issue.fix?.kind === 'ctime') {
    // R3-style fix: move NTFS creation time to the file's own best-known time
    const items: PlanItem[] = []
    for (const f of scoped) {
      const instant =
        parseIso(f.creationTimeIso ?? undefined) ??
        parseIso(f.filenameTimeIso ?? undefined) ??
        null
      if (!instant) continue
      const apply = { path: f.path, ctimeIso: instant.toISOString() }
      if (Math.abs(new Date(apply.ctimeIso).getTime() - f.birthtimeMs) <= 999) continue
      const changes: PlanFieldChange[] = [
        {
          field: 'ctime',
          from: formatLocal(new Date(f.birthtimeMs)),
          to: formatLocal(instant)
        }
      ]
      items.push({
        path: f.path,
        name: f.name,
        timeSource: f.creationTimeIso ? 'metadata' : 'filename',
        apply,
        changes
      })
    }
    return { items, skipped: [] }
  }
  return { items: [], skipped: [] }
}
