/**
 * Land ffmpeg/ffprobe into resources/ffmpeg/ so electron-builder can bundle
 * them (extraResources). Order:
 *   1. already landed -> done
 *   2. copy from system PATH (fastest, but the local build may be GPL — fine
 *      for local dogfood builds, NOT for public distribution)
 *   3. download the BtbN win64 LGPL build (safe to redistribute)
 *
 * Run: node scripts/fetch-ffmpeg.mjs
 */
import { existsSync, mkdirSync, copyFileSync, createWriteStream } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const destDir = join(root, 'resources', 'ffmpeg')
const ffmpegExe = join(destDir, 'ffmpeg.exe')
const ffprobeExe = join(destDir, 'ffprobe.exe')

if (existsSync(ffmpegExe) && existsSync(ffprobeExe)) {
  console.log('ffmpeg: already landed in resources/ffmpeg')
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })

function findOnPath() {
  try {
    const out = execFileSync('where.exe', ['ffmpeg', 'ffprobe'], { encoding: 'utf8' })
    const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const ffmpeg = lines.find((l) => l.toLowerCase().endsWith('ffmpeg.exe'))
    const ffprobe = lines.find((l) => l.toLowerCase().endsWith('ffprobe.exe'))
    if (ffmpeg && ffprobe) return { ffmpeg, ffprobe }
  } catch {
    /* not on PATH */
  }
  return null
}

async function downloadLGPL() {
  const url =
    'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-lgpl.zip'
  const cacheZip = join(root, '.cache', 'ffmpeg', 'win64-lgpl.zip')
  mkdirSync(dirname(cacheZip), { recursive: true })
  if (!existsSync(cacheZip)) {
    console.log(`ffmpeg: downloading LGPL build (${url})`)
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(cacheZip))
  } else {
    console.log('ffmpeg: reusing cached LGPL zip')
  }
  // Windows 10 ships bsdtar, which handles zip
  const extractDir = join(root, '.cache', 'ffmpeg', 'extract')
  mkdirSync(extractDir, { recursive: true })
  execFileSync('tar', ['-xf', cacheZip, '-C', extractDir], { stdio: 'inherit' })
  const binDir = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-ChildItem -Recurse -Filter ffmpeg.exe "${extractDir}" | Select-Object -First 1).DirectoryName`
    ],
    { encoding: 'utf8' }
  ).trim()
  return { ffmpeg: join(binDir, 'ffmpeg.exe'), ffprobe: join(binDir, 'ffprobe.exe') }
}

let found = findOnPath()
let source = 'system PATH'
if (!found) {
  found = await downloadLGPL()
  source = 'BtbN LGPL build (redistributable)'
}

copyFileSync(found.ffmpeg, ffmpegExe)
copyFileSync(found.ffprobe, ffprobeExe)
console.log(`ffmpeg: landed ffmpeg + ffprobe in resources/ffmpeg (source: ${source})`)
if (source.startsWith('system')) {
  console.log(
    'ffmpeg: NOTE — binaries copied from PATH may be GPL builds. For a publicly ' +
      'distributed installer, delete resources/ffmpeg and re-run to fetch the LGPL build.'
  )
}
