import { promises as fsp } from 'fs'
import path from 'path'
import { resolveFfmpeg, run } from './ffmpeg'

const FORMAT_MAP: Record<string, string> = {
  '.mp4': 'mp4',
  '.mov': 'mov',
  '.avi': 'avi',
  '.mkv': 'matroska',
  '.flv': 'flv',
  '.wmv': 'wmv',
  '.mpg': 'mpeg',
  '.mpeg': 'mpeg',
  '.m4v': 'mp4',
  '.webm': 'webm',
  '.ts': 'mpegts',
  '.3gp': 'mp4'
}

function tmpSiblingFor(file: string): string {
  const dir = path.dirname(file)
  const ext = path.extname(file) || '.mp4'
  const name = path.basename(file)
  return path.join(dir, `.${name}.cktmp${ext}`)
}

/**
 * Rewrite container metadata losslessly (stream copy remux into a sibling
 * temp file, then replace the original). The caller is responsible for
 * backups and journal entries.
 */
export async function writeMetadata(file: string, tags: Record<string, string>): Promise<void> {
  const { ffmpeg } = resolveFfmpeg()
  const tmp = tmpSiblingFor(file)
  const ext = path.extname(file).toLowerCase()
  const format = FORMAT_MAP[ext]

  const args = ['-hide_banner', '-loglevel', 'error', '-i', file, '-map', '0', '-c', 'copy']
  for (const [k, v] of Object.entries(tags)) {
    args.push('-metadata', `${k}=${v}`)
  }
  if (format) args.push('-f', format)
  args.push('-y', tmp)

  try {
    const r = await run(ffmpeg, args, 120_000)
    const tmpOk = r.code === 0 && (await fsp.stat(tmp).then((s) => s.size > 0).catch(() => false))
    if (!tmpOk) {
      throw new Error(r.stderr.slice(0, 300) || 'ffmpeg metadata write failed')
    }
    try {
      await fsp.rename(tmp, file)
    } catch {
      await fsp.unlink(file).catch(() => {})
      await fsp.rename(tmp, file)
    }
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {})
    throw e
  }
}
