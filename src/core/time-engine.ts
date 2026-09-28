export interface TimeShift {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  ms?: number
}

export function shiftDate(d: Date, s: TimeShift): Date {
  const delta =
    (s.days ?? 0) * 86_400_000 +
    (s.hours ?? 0) * 3_600_000 +
    (s.minutes ?? 0) * 60_000 +
    (s.seconds ?? 0) * 1000 +
    (s.ms ?? 0)
  return new Date(d.getTime() + delta)
}

/**
 * Parse ffprobe/ffmpeg date strings:
 * "2023-01-01T12:00:00.000000Z", "2023-01-01T12:00:00+08:00", "2023-01-01 12:00:00".
 * Naive values (no timezone) are treated as UTC, matching ffmpeg's convention
 * for container timestamps.
 */
export function parseFfprobeDate(v?: string | null): Date | null {
  if (!v) return null
  const s = v.trim()
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/
  )
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [, y, mo, d, h, mi, sec, frac, tz] = m
  const ms = frac ? Math.min(999, Math.round(Number(`0.${frac}`) * 1000)) : 0
  const tzPart = !tz || tz === 'Z' ? 'Z' : tz
  const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}.${String(ms).padStart(3, '0')}${tzPart}`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/** Format a Date the way ffmpeg expects/writes container creation_time tags. */
export function toFfprobeCreationTime(d: Date): string {
  const iso = d.toISOString()
  return `${iso.slice(0, 19)}.000000Z`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "2023-01-01 09:05:03" in the viewer's local timezone. */
export function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

/** Sanity window: 1990-01-01 .. now + 2 days. */
export function isPlausibleDate(d: Date): boolean {
  const t = d.getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.UTC(1990, 0, 1) && t < Date.now() + 2 * 86_400_000
}

export interface SourceTimeFacts {
  metadataTime?: Date | null
  filenameTime?: Date | null
  fsTime?: Date | null
}

export type TimeSourceKind = 'metadata' | 'filename' | 'filesystem'

/**
 * Priority chain: container metadata creation_time -> filename timestamp ->
 * filesystem mtime. Returns the first plausible candidate.
 */
export function pickSourceTime(f: SourceTimeFacts): { date: Date; source: TimeSourceKind } | null {
  if (f.metadataTime && isPlausibleDate(f.metadataTime)) return { date: f.metadataTime, source: 'metadata' }
  if (f.filenameTime && isPlausibleDate(f.filenameTime)) return { date: f.filenameTime, source: 'filename' }
  if (f.fsTime && isPlausibleDate(f.fsTime)) return { date: f.fsTime, source: 'filesystem' }
  return null
}
