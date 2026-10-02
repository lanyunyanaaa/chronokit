import { pickSourceTime } from './time-engine'

/**
 * Smart rename (智能重命名): time → filename, the reverse of the filename
 * parser. Pure planning only — the main process performs the actual renames
 * and journals them for undo.
 */

export interface RenameFacts {
  path: string
  name: string
  creationTimeIso?: string | null
  filenameTimeIso?: string | null
  mtimeMs: number
}

export type RenamePattern = 'stamp' | 'stamp-dash' | 'date-prefix'

export interface RenameOptions {
  pattern: RenamePattern
  prefix: string
  suffix: string
  conflict: 'skip' | 'sequence'
}

export interface RenameEntry {
  path: string
  from: string
  to: string
}

export interface RenameSkipped {
  path: string
  name: string
  reason: 'NO_TIME' | 'UNCHANGED'
}

export interface RenamePlan {
  renames: RenameEntry[]
  skipped: RenameSkipped[]
}

const p2 = (n: number): string => String(n).padStart(2, '0')

/** Render the timestamp part of the new name for the chosen pattern. */
export function renderStamp(d: Date, pattern: RenamePattern): string {
  const date = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
  const time = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`
  if (pattern === 'stamp-dash') {
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${time}`
  }
  return `${date}_${time}`
}

/**
 * Build the rename plan. `takenNames` are names that already exist in the
 * target folders (sibling files as seen by the caller); conflicts resolve by
 * skip or by appending a sequence number before the extension.
 */
export function buildRenamePlan(
  files: RenameFacts[],
  options: RenameOptions,
  takenNames: Iterable<string> = []
): RenamePlan {
  const taken = new Set([...takenNames].map((n) => n.toLowerCase()))
  const renames: RenameEntry[] = []
  const skipped: RenameSkipped[] = []
  const seqByTarget = new Map<string, number>()

  for (const f of files) {
    const dot = f.name.lastIndexOf('.')
    const stem = dot > 0 ? f.name.slice(0, dot) : f.name
    const ext = dot > 0 ? f.name.slice(dot) : ''

    const picked = pickSourceTime({
      metadataTime: f.creationTimeIso ? new Date(f.creationTimeIso) : null,
      filenameTime: f.filenameTimeIso ? new Date(f.filenameTimeIso) : null,
      fsTime: new Date(f.mtimeMs)
    })
    if (!picked) {
      skipped.push({ path: f.path, name: f.name, reason: 'NO_TIME' })
      continue
    }

    const stamp = renderStamp(picked.date, options.pattern)
    const base =
      options.pattern === 'date-prefix' ? `${stamp}_${stem}` : `${options.prefix}${stamp}${options.suffix}`
    let target = `${base}${ext}`

    if (target.toLowerCase() === f.name.toLowerCase()) {
      skipped.push({ path: f.path, name: f.name, reason: 'UNCHANGED' })
      continue
    }

    if (taken.has(target.toLowerCase())) {
      if (options.conflict === 'skip') {
        skipped.push({ path: f.path, name: f.name, reason: 'UNCHANGED' })
        continue
      }
      // sequence: base-001, base-002, … before the extension
      let seq = seqByTarget.get(base) ?? 1
      let candidate = `${base}-${String(seq).padStart(3, '0')}${ext}`
      while (taken.has(candidate.toLowerCase())) {
        seq++
        candidate = `${base}-${String(seq).padStart(3, '0')}${ext}`
      }
      seqByTarget.set(base, seq + 1)
      target = candidate
    }

    taken.add(target.toLowerCase())
    renames.push({ path: f.path, from: f.name, to: target })
  }

  return { renames, skipped }
}
