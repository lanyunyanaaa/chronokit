import { promises as fsp } from 'fs'
import path from 'path'
import type { RecentDir } from '@shared/index'
import { getDataRoot } from './paths'

const MAX_ENTRIES = 10

function recentsPath(): string {
  return path.join(getDataRoot(), 'recents.json')
}

function sanitize(raw: unknown): RecentDir[] {
  if (!Array.isArray(raw)) return []
  const out: RecentDir[] = []
  const seen = new Set<string>()
  for (const it of raw) {
    const p = (it as RecentDir)?.path
    if (typeof p !== 'string' || !p) continue
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path: p, ts: typeof (it as RecentDir).ts === 'number' ? (it as RecentDir).ts : 0 })
  }
  return out
}

/** List remembered folders, dropping entries whose folder no longer exists. */
export async function listRecentDirs(): Promise<RecentDir[]> {
  let raw: unknown
  try {
    raw = JSON.parse(await fsp.readFile(recentsPath(), 'utf8'))
  } catch {
    return []
  }
  const entries = await Promise.all(
    sanitize(raw).map(async (r) => {
      try {
        const st = await fsp.stat(r.path)
        return st.isDirectory() ? r : null
      } catch {
        return null
      }
    })
  )
  return entries.filter((r): r is RecentDir => r !== null)
}

/** Remember a folder (moved to the top, capped, deduped case-insensitively). */
export async function addRecentDir(dir: string): Promise<RecentDir[]> {
  const list = (await listRecentDirs()).filter((r) => r.path.toLowerCase() !== dir.toLowerCase())
  list.unshift({ path: dir, ts: Date.now() })
  const capped = list.slice(0, MAX_ENTRIES)
  await fsp
    .writeFile(recentsPath(), JSON.stringify(capped, null, 2), 'utf8')
    .catch(() => {})
  return capped
}
