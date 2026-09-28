import { spawn, spawnSync } from 'child_process'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export interface FfmpegBinaries {
  ffmpeg: string
  ffprobe: string
}

let cached: FfmpegBinaries | null = null

function exeName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base
}

function tryResolve(dir: string): FfmpegBinaries | null {
  const ffmpeg = join(dir, exeName('ffmpeg'))
  const ffprobe = join(dir, exeName('ffprobe'))
  if (!existsSync(ffmpeg) || !existsSync(ffprobe)) return null
  try {
    const r = spawnSync(ffmpeg, ['-version'], { windowsHide: true, timeout: 5000 })
    if (r.status !== 0) return null
    return { ffmpeg, ffprobe }
  } catch {
    return null
  }
}

/**
 * Resolve ffmpeg/ffprobe binaries: CK_FFMPEG_DIR env -> bundled resources ->
 * system PATH. Throws a stable error code when nothing works.
 */
export function resolveFfmpeg(): FfmpegBinaries {
  if (cached) return cached
  const candidates: string[] = []
  if (process.env.CK_FFMPEG_DIR) candidates.push(process.env.CK_FFMPEG_DIR)
  if (app.isPackaged) candidates.push(join(process.resourcesPath, 'ffmpeg'))
  else candidates.push(join(app.getAppPath(), 'resources', 'ffmpeg'))

  for (const dir of candidates) {
    const found = tryResolve(dir)
    if (found) {
      cached = found
      return cached
    }
  }

  try {
    const r1 = spawnSync('ffmpeg', ['-version'], { windowsHide: true, timeout: 5000 })
    const r2 = spawnSync('ffprobe', ['-version'], { windowsHide: true, timeout: 5000 })
    if (r1.status === 0 && r2.status === 0) {
      cached = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }
      return cached
    }
  } catch {
    /* fall through */
  }
  throw new Error('FFMPEG_NOT_FOUND')
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

/** Spawn a process with an argv array (no shell, no quoting issues). */
export function run(bin: string, args: string[], timeoutMs = 60_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`timeout after ${timeoutMs}ms: ${bin} ${args.slice(0, 4).join(' ')}`))
    }, timeoutMs)
    child.stdout.on('data', (d) => {
      stdout += String(d)
      if (stdout.length > 8_000_000) stdout = stdout.slice(-2_000_000)
    })
    child.stderr.on('data', (d) => {
      stderr += String(d)
      if (stderr.length > 2_000_000) stderr = stderr.slice(-500_000)
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}
