import { promises as fsp } from 'fs'
import path from 'path'
import type { SessionSnapshot } from '@shared/index'
import { getDataRoot } from './paths'

function sessionPath(): string {
  return path.join(getDataRoot(), 'session.json')
}

function sanitizeLists(raw: unknown): SessionSnapshot['lists'] {
  const clean = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string' && !!p).slice(0, 5000) : []
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    sources: clean(r.sources),
    targets: clean(r.targets),
    tools: clean(r.tools),
    checkup: clean(r.checkup),
    table: clean(r.table),
    rename: clean(r.rename)
  }
}

function sanitizeEdits(raw: unknown): SessionSnapshot['tableEdits'] {
  const out: SessionSnapshot['tableEdits'] = {}
  if (!raw || typeof raw !== 'object') return out
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  for (const [path, e] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof path !== 'string' || !path || !e || typeof e !== 'object') continue
    const rec = e as Record<string, unknown>
    const edit: SessionSnapshot['tableEdits'][string] = {}
    const md = num(rec.metadataMs)
    const mt = num(rec.mtimeMs)
    const ct = num(rec.ctimeMs)
    if (md != null) edit.metadataMs = md
    if (mt != null) edit.mtimeMs = mt
    if (ct != null) edit.ctimeMs = ct
    if (Object.keys(edit).length) out[path] = edit
  }
  return out
}

export function sanitizeSession(raw: unknown): SessionSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const lists = sanitizeLists(r.lists)
  const hasFiles = lists.sources.length + lists.targets.length + lists.tools.length > 0
  if (!hasFiles) return null
  return {
    version: 1,
    savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
    lists,
    tableEdits: sanitizeEdits(r.tableEdits),
    activePage: typeof r.activePage === 'string' ? r.activePage : 'sync',
    threshold: typeof r.threshold === 'number' ? r.threshold : 0.75
  }
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  try {
    return sanitizeSession(JSON.parse(await fsp.readFile(sessionPath(), 'utf8')))
  } catch {
    return null
  }
}

/** Persist the workspace snapshot (atomic tmp+rename, like the journal). */
export async function saveSession(snapshot: SessionSnapshot): Promise<void> {
  const tmp = `${sessionPath()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8')
  try {
    await fsp.rename(tmp, sessionPath())
  } catch {
    await fsp.copyFile(tmp, sessionPath())
    await fsp.unlink(tmp).catch(() => {})
  }
}
