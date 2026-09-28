import { statSync } from 'fs'
import type { MediaInfo, StreamInfo } from '@shared/index'
import { parseFfprobeDate } from '@core/time-engine'
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

export async function probeFile(path: string): Promise<MediaInfo> {
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

export async function probeFiles(
  paths: string[],
  onProgress?: (done: number, total: number) => void
): Promise<(MediaInfo | null)[]> {
  const out: (MediaInfo | null)[] = []
  for (let i = 0; i < paths.length; i++) {
    try {
      out.push(await probeFile(paths[i]))
    } catch {
      out.push(null)
    }
    onProgress?.(i + 1, paths.length)
  }
  return out
}
