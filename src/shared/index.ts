// Shared types & constants used by main process, preload and renderer.

export const SUPPORTED_VIDEO_EXTS = [
  '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.mpg', '.mpeg', '.m4v', '.webm', '.ts', '.3gp'
] as const

export const DEFAULT_MATCH_THRESHOLD = 0.75

export interface StreamInfo {
  index: number
  type: 'video' | 'audio' | 'subtitle' | 'other'
  codec?: string
  width?: number
  height?: number
  fps?: number
  durationSec?: number
  sampleRate?: number
  channels?: number
  tags?: Record<string, string>
}

export interface MediaInfo {
  path: string
  size: number
  durationSec?: number
  formatName?: string
  bitrate?: number
  /** ISO UTC creation time read from container/stream metadata */
  creationTimeIso?: string
  tags: Record<string, string>
  streams: StreamInfo[]
}

export interface FileStatInfo {
  path: string
  name: string
  size: number
  mtimeMs: number
  atimeMs: number
  birthtimeMs: number
}

export type MatchMethod = 'exact-name' | 'fuzzy-name' | 'size' | 'duration' | 'manual'

export interface MatchPair {
  targetPath: string
  sourcePath: string
  method: MatchMethod
  score: number
}

export type TimeSourceKind = 'metadata' | 'filename' | 'filesystem'
export type PlanTimeSource = TimeSourceKind | 'manual' | 'shift'

export type PlanField = 'creation_time' | 'mtime' | 'ctime'

/** Concrete machine-writable change set for one file, executed by the main process. */
export interface ApplyItem {
  path: string
  metadata?: Record<string, string>
  mtimeMs?: number
  atimeMs?: number
  ctimeIso?: string
}

/** Human-readable change row for the dry-run preview table. */
export interface PlanFieldChange {
  field: PlanField
  from?: string
  to: string
}

export interface PlanItem {
  path: string
  name: string
  sourcePath?: string
  timeSource?: PlanTimeSource
  apply: ApplyItem
  changes: PlanFieldChange[]
}

export interface PlanSkipped {
  path: string
  name: string
  reason: 'NO_SOURCE' | 'NO_SOURCE_TIME' | 'NO_CHANGES' | 'NO_FILENAME_TIME' | 'NO_BASE_TIME'
}

export interface BuildPlanResult {
  items: PlanItem[]
  skipped: PlanSkipped[]
}

export interface ExecResult {
  okCount: number
  failCount: number
  errors: { path: string; message: string }[]
}

export interface JournalFileEntry {
  path: string
  backupPath?: string
  before: { mtimeMs: number; atimeMs: number; birthtimeMs: number }
  after: { mtimeMs?: number; atimeMs?: number; birthtimeMs?: number }
  error?: string
}

export interface JournalOp {
  id: string
  ts: number
  kind: 'sync' | 'set-time' | 'shift-time' | 'from-filename' | 'metadata'
  label: string
  status: 'done' | 'undone'
  entries: JournalFileEntry[]
}

export interface AppInfo {
  version: string
  platform: string
  dataRoot: string
  isPackaged: boolean
  ffmpegPath?: string
  ffprobePath?: string
  ffmpegError?: string
}

export interface RecentDir {
  path: string
  ts: number
}

export interface TaskProgress {
  task: string
  done: number
  total: number
  message?: string
}
