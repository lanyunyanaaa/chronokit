import { createHash } from 'crypto'
import { promises as fsp } from 'fs'
import path from 'path'
import { resolveFfmpeg, run } from './ffmpeg'
import { thumbCacheDir } from './paths'

const MAX_ACTIVE = 3
let active = 0
const waiting: (() => void)[] = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) {
    await new Promise<void>((res) => waiting.push(res))
  }
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

const inflight = new Map<string, Promise<string | null>>()

/** Extract a representative frame (10% into the clip) as a JPEG data URL. */
export async function getThumbDataUrl(file: string, durationSec?: number): Promise<string | null> {
  const key = `${file}|${Math.round(durationSec ?? -1)}`
  const existing = inflight.get(key)
  if (existing) return existing
  const p = withSlot(() => extractThumb(file, durationSec))
  inflight.set(key, p)
  try {
    return await p
  } finally {
    inflight.delete(key)
  }
}

async function extractThumb(file: string, durationSec?: number): Promise<string | null> {
  try {
    const st = await fsp.stat(file)
    const hash = createHash('md5')
      .update(`${file}|${st.size}|${Math.round(st.mtimeMs)}`)
      .digest('hex')
    const cachePath = path.join(thumbCacheDir(), `${hash}.jpg`)

    const cached = await fsp.readFile(cachePath).catch(() => null)
    if (cached) return `data:image/jpeg;base64,${cached.toString('base64')}`

    const at = durationSec && durationSec > 1 ? Math.min(durationSec * 0.1, Math.max(durationSec - 0.5, 0)) : 0
    const { ffmpeg } = resolveFfmpeg()
    const r = await run(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=384:-2', '-q:v', '4', '-y', cachePath],
      20_000
    )
    if (r.code !== 0) return null
    const data = await fsp.readFile(cachePath).catch(() => null)
    if (!data) return null
    return `data:image/jpeg;base64,${data.toString('base64')}`
  } catch {
    return null
  }
}
