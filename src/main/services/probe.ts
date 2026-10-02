import { statSync, promises as fsp } from 'fs'
import type { MediaInfo, StreamInfo } from '@shared/index'
import { isPhotoPath } from '@shared/index'
import { parseFfprobeDate } from '@core/time-engine'
import { readExifCreationTime } from '@core/exif'
import { resolveFfmpeg, run } from './ffmpeg'

function num(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : undefined
}

function pickCreationTime(data: Record<string, any>): string | undefined {
  const streams: any[] = data.streams ?? []
  const vstream = streams.find((s) => s.codec_type === 'video' && s.tags?.creation_time)
  if (vstream) return vstream.tags.creation_time
  if (data.format?.tags?.creation_time) return data.format.tags.creation_time
  const anyStream = streams.find((s) => s.tags?.creation_time)
  return anyStream?.tags.creation_time
}

/**
 * Photos: read EXIF directly instead of ffprobe (which doesn't surface EXIF
 * creation dates). Only the first 256 KB are read — EXIF lives in the header.
 */
async function probePhotoFile(path: string): Promise<MediaInfo> {
  const fh = await fsp.open(path, 'r')
  try {
    const head = Buffer.alloc(262_144)
    const { bytesRead } = await fh.read(head, 0, head.length, 0)
    const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
    const exif = readExifCreationTime(head.buffer.slice(head.byteOffset, head.byteOffset + bytesRead), ext)
    return {
      path,
      size: statSync(path).size,
      formatName: ext === '.png' ? 'png' : 'jpeg',
      creationTimeIso: exif?.isoUtc,
      tags: exif?.tags ?? {},
      streams: []
    }
  } finally {
    await fh.close()
  }
}

export async function probeFile(path: string): Promise<MediaInfo> {
  if (isPhotoPath(path)) return probePhotoFile(path)
  const { ffprobe } = resolveFfmpeg()
  const r = await run(
    ffprobe,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
    30_000
  )
  if (r.code !== 0) throw new Error(r.stderr.slice(0, 300) || 'ffprobe failed')
  const data = JSON.parse(r.stdout) as Record<string, any>

  const tags: Record<string, string> = {}
  for (const [k, v] of Object.entries(data.format?.tags ?? {})) {
    if (typeof v === 'string') tags[k] = v
  }

  const streams: StreamInfo[] = (data.streams ?? []).map((s: any, i: number): StreamInfo => {
    for (const [k, v] of Object.entries(s.tags ?? {})) {
      if (typeof v === 'string' && (s.codec_type === 'video' || tags[k] == null)) tags[k] = v
    }
    let fps: number | undefined
    const fpsRaw = s.avg_frame_rate ?? s.r_frame_rate
    if (typeof fpsRaw === 'string' && fpsRaw.includes('/')) {
      const [a, b] = fpsRaw.split('/').map(Number)
      if (b > 0 && Number.isFinite(a / b)) fps = Math.round((a / b) * 100) / 100
    }
    return {
      index: s.index ?? i,
      type:
        s.codec_type === 'video'
          ? 'video'
          : s.codec_type === 'audio'
            ? 'audio'
            : s.codec_type === 'subtitle'
              ? 'subtitle'
              : 'other',
      codec: s.codec_name,
      width: s.width,
      height: s.height,
      fps,
      durationSec: num(s.duration),
      sampleRate: num(s.sample_rate),
      channels: s.channels,
      tags: (s.tags ?? {}) as Record<string, string>
    }
  })

  const creationTimeIso = pickCreationTime(data)
  if (creationTimeIso && !parseFfprobeDate(creationTimeIso)) {
    // unparsable creation_time -> surface as plain tag only
  }

  return {
    path,
    size: statSync(path).size,
    durationSec: num(data.format?.duration),
    formatName: data.format?.format_name,
    bitrate: num(data.format?.bit_rate),
    creationTimeIso,
    tags,
    streams
  }
}

/** Bound the number of concurrent ffprobe processes; spawns are the cost. */
const PROBE_CONCURRENCY = 6

export async function probeFiles(
  paths: string[],
  onProgress?: (done: number, total: number) => void
): Promise<(MediaInfo | null)[]> {
  const out: (MediaInfo | null)[] = new Array(paths.length).fill(null)
  let done = 0
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < paths.length) {
      const i = next++
      try {
        out[i] = await probeFile(paths[i])
      } catch {
        out[i] = null
      }
      done++
      onProgress?.(done, paths.length)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, paths.length) }, () => worker())
  )
  return out
}
