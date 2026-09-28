import { isPlausibleDate } from './time-engine'

export interface FilenameTimePattern {
  id: string
  label: string
  regex: RegExp
  build: (m: RegExpMatchArray) => Date | null
}

export interface FilenameTimeResult {
  date: Date
  patternId: string
  patternLabel: string
}

/**
 * Construct a local-time Date from components, rejecting impossible values
 * (month 13, Feb 30, hour 25 ...).
 */
function localDate(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (!Number.isInteger(y) || y < 1970 || y > 2100) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  const dt = new Date(y, mo - 1, d, h, mi, s)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

function epochMs(ms: number): Date | null {
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return isPlausibleDate(d) ? d : null
}

/**
 * Pluggable filename timestamp patterns, matched against the file stem.
 * Camera filenames are treated as LOCAL time; epoch-based names are absolute.
 * New vendor patterns can be appended here (or loaded from settings in a later version).
 */
export const FILENAME_TIME_PATTERNS: FilenameTimePattern[] = [
  {
    id: 'wechat-mmexport',
    label: 'WeChat mmexport (epoch ms)',
    regex: /^mmexport(\d{13})/,
    build: (m) => epochMs(Number(m[1]))
  },
  {
    id: 'prefixed-ymd-his',
    label: 'IMG_/VID_/PXL_ YYYYMMDD_HHMMSS',
    regex: /^(?:IMG|VID|MOV|MVIMG|PXL|VIDEO)[_-](\d{4})(\d{2})(\d{2})[_\-.T]?(\d{2})(\d{2})(\d{2})(?:\d{1,6})?/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'dji-ymd-his',
    label: 'DJI_ YYYYMMDD_HHMMSS',
    regex: /^DJI[_-](\d{4})(\d{2})(\d{2})[_\-.]?(\d{2})(\d{2})(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'android-screenshot',
    label: 'Screenshot_YYYY-MM-DD-HH-MM-SS',
    regex: /^Screenshot[_-](\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'android-screenshot-compact',
    label: 'Screenshot_YYYYMMDD-HHMMSS',
    regex: /^Screenshot[_-](\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'wechat-wx',
    label: 'WX_YYYYMMDD-HHMMSS',
    regex: /^WX(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'ios-screenrecording-us',
    label: 'ScreenRecording_MM-DD-YYYY HH-MM-SS',
    regex: /^Screen[ _]?Recording[ _]?(\d{1,2})-(\d{1,2})-(\d{4})[ _]?(\d{1,2})-(\d{2})(?:-(\d{2}))?/,
    build: (m) => localDate(+m[3], +m[1], +m[2], +m[4], +m[5], m[6] ? +m[6] : 0)
  },
  {
    id: 'ios-screenrecording-iso',
    label: 'Screen Recording YYYY-MM-DD at HH.MM.SS',
    regex: /^Screen Recording (\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'whatsapp-video',
    label: 'WhatsApp Video YYYY-MM-DD at HH.MM.SS',
    regex: /^WhatsApp Video (\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'generic-ymd-his',
    label: 'Generic YYYYMMDD_HHMMSS',
    regex: /^(\d{4})(\d{2})(\d{2})[_\-.T]?(\d{2})(\d{2})(\d{2})(?:\d{1,6})?/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  },
  {
    id: 'generic-dashed',
    label: 'Generic YYYY-MM-DD HH.MM.SS',
    regex: /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})[.\-](\d{2})[.\-](\d{2})/,
    build: (m) => localDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6])
  }
]

/**
 * Parse a timestamp out of a filename. Matched against the basename (stem),
 * anchored at the start to avoid false positives deep inside names.
 */
export function parseTimeFromFilename(pathOrName: string): FilenameTimeResult | null {
  let base = pathOrName
  const bs = base.lastIndexOf('\\')
  if (bs >= 0) base = base.slice(bs + 1)
  const fs = base.lastIndexOf('/')
  if (fs >= 0) base = base.slice(fs + 1)

  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base

  for (const p of FILENAME_TIME_PATTERNS) {
    const m = stem.match(p.regex)
    if (!m) continue
    const date = p.build(m)
    if (date && isPlausibleDate(date)) {
      return { date, patternId: p.id, patternLabel: p.label }
    }
  }
  return null
}
