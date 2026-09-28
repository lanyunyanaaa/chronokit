import type {
  ApplyItem,
  BuildPlanResult,
  PlanFieldChange,
  PlanItem,
  PlanSkipped,
  PlanTimeSource,
  TimeSourceKind
} from '../shared/index'
import {
  formatLocal,
  isPlausibleDate,
  parseFfprobeDate,
  pickSourceTime,
  shiftDate,
  toFfprobeCreationTime
} from './time-engine'

export interface PlanFileFacts {
  path: string
  name: string
  creationTimeIso?: string | null
  filenameTimeIso?: string | null
  mtimeMs: number
  birthtimeMs: number
}

export interface SyncPlanEntry {
  target: PlanFileFacts
  source?: PlanFileFacts | null
}

export interface SyncOptions {
  metadata: boolean
  mtime: boolean
  ctime: boolean
}

export interface ToolPlanParams {
  mode: 'absolute' | 'shift' | 'filename'
  absoluteIso?: string
  shift?: { hours: number; minutes: number }
}

function instantsEqual(a: number | null | undefined, b: number | null | undefined, tolMs = 999): boolean {
  if (a == null || b == null) return false
  return Math.abs(a - b) <= tolMs
}

function applyFromInstant(instant: Date, opts: SyncOptions, isWin: boolean, path: string): ApplyItem {
  const apply: ApplyItem = { path }
  if (opts.metadata) apply.metadata = { creation_time: toFfprobeCreationTime(instant) }
  if (opts.mtime) apply.mtimeMs = instant.getTime()
  if (opts.ctime && isWin) apply.ctimeIso = instant.toISOString()
  return apply
}

function changesFor(
  target: PlanFileFacts,
  instant: Date,
  apply: ApplyItem,
  isWin: boolean
): PlanFieldChange[] {
  const changes: PlanFieldChange[] = []
  if (apply.metadata) {
    const cur = parseFfprobeDate(target.creationTimeIso ?? undefined)
    if (!cur || !instantsEqual(cur.getTime(), instant.getTime())) {
      changes.push({
        field: 'creation_time',
        from: cur ? formatLocal(cur) : undefined,
        to: formatLocal(instant)
      })
    }
  }
  if (apply.mtimeMs != null && !instantsEqual(target.mtimeMs, apply.mtimeMs)) {
    changes.push({
      field: 'mtime',
      from: formatLocal(new Date(target.mtimeMs)),
      to: formatLocal(new Date(apply.mtimeMs))
    })
  }
  if (apply.ctimeIso && isWin && !instantsEqual(target.birthtimeMs, instant.getTime())) {
    changes.push({
      field: 'ctime',
      from: formatLocal(new Date(target.birthtimeMs)),
      to: formatLocal(instant)
    })
  }
  return changes
}

function factsToSourceFacts(f: PlanFileFacts) {
  return {
    metadataTime: parseFfprobeDate(f.creationTimeIso ?? undefined),
    filenameTime: f.filenameTimeIso ? new Date(f.filenameTimeIso) : null,
    fsTime: new Date(f.mtimeMs)
  }
}

/**
 * Build the dry-run plan for the sync page: for every target paired with a
 * source, resolve the source instant via the priority chain and diff it
 * against the target's current values.
 */
export function buildSyncPlan(
  entries: SyncPlanEntry[],
  options: SyncOptions,
  isWin: boolean
): BuildPlanResult {
  const items: PlanItem[] = []
  const skipped: PlanSkipped[] = []

  for (const { target, source } of entries) {
    if (!source) {
      skipped.push({ path: target.path, name: target.name, reason: 'NO_SOURCE' })
      continue
    }
    const picked = pickSourceTime(factsToSourceFacts(source))
    if (!picked) {
      skipped.push({ path: target.path, name: target.name, reason: 'NO_SOURCE_TIME' })
      continue
    }
    const apply = applyFromInstant(picked.date, options, isWin, target.path)
    const changes = changesFor(target, picked.date, apply, isWin)
    if (changes.length === 0) {
      skipped.push({ path: target.path, name: target.name, reason: 'NO_CHANGES' })
      continue
    }
    items.push({
      path: target.path,
      name: target.name,
      sourcePath: source.path,
      timeSource: picked.source,
      apply,
      changes
    })
  }
  return { items, skipped }
}

/**
 * Build the dry-run plan for the time-tools page:
 * - absolute: set every file to a chosen instant
 * - shift:    move each file's own best-known time by a delta (timezone fixes)
 * - filename: apply the timestamp parsed from each file's own name
 */
export function buildToolPlan(
  files: PlanFileFacts[],
  params: ToolPlanParams,
  options: SyncOptions,
  isWin: boolean
): BuildPlanResult {
  const items: PlanItem[] = []
  const skipped: PlanSkipped[] = []

  for (const target of files) {
    let instant: Date | null = null
    let source: PlanTimeSource | undefined

    if (params.mode === 'absolute' && params.absoluteIso) {
      instant = new Date(params.absoluteIso)
      source = 'manual'
    } else if (params.mode === 'shift') {
      const base = pickSourceTime(factsToSourceFacts(target))
      if (base) {
        instant = shiftDate(base.date, {
          hours: params.shift?.hours ?? 0,
          minutes: params.shift?.minutes ?? 0
        })
        source = 'shift'
      }
    } else if (params.mode === 'filename') {
      instant = target.filenameTimeIso ? new Date(target.filenameTimeIso) : null
      if (instant) source = 'filename'
    }

    if (!instant || !isPlausibleDate(instant)) {
      skipped.push({
        path: target.path,
        name: target.name,
        reason: params.mode === 'filename' ? 'NO_FILENAME_TIME' : 'NO_BASE_TIME'
      })
      continue
    }

    const apply = applyFromInstant(instant, options, isWin, target.path)
    const changes = changesFor(target, instant, apply, isWin)
    if (changes.length === 0) {
      skipped.push({ path: target.path, name: target.name, reason: 'NO_CHANGES' })
      continue
    }
    items.push({
      path: target.path,
      name: target.name,
      timeSource: source as PlanTimeSource,
      apply,
      changes
    })
  }
  return { items, skipped }
}

export type { TimeSourceKind }
