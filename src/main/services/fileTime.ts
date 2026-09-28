import { spawn } from 'child_process'
import { promises as fsp } from 'fs'
import path from 'path'
import { tmpDir } from './paths'

export function isWin(): boolean {
  return process.platform === 'win32'
}

export async function setTimes(
  file: string,
  times: { mtimeMs?: number; atimeMs?: number }
): Promise<void> {
  const st = await fsp.stat(file)
  const atime = times.atimeMs != null ? new Date(times.atimeMs) : st.atime
  const mtime = times.mtimeMs != null ? new Date(times.mtimeMs) : st.mtime
  await fsp.utimes(file, atime, mtime)
}

export interface CreationTimeItem {
  path: string
  isoUtc: string
}

export interface CreationTimeResult {
  path: string
  ok: boolean
  error?: string
}

/**
 * Set NTFS creation times for a batch of files. Windows only; one PowerShell
 * process handles the whole batch (paths/values exchanged via UTF-8 JSON on
 * disk to avoid any quoting issues).
 */
export async function setCreationTimes(items: CreationTimeItem[]): Promise<CreationTimeResult[]> {
  if (!items.length) return []
  if (!isWin()) {
    throw new Error('Creation time writing is only supported on Windows/NTFS')
  }

  const dir = tmpDir()
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const jsonPath = path.join(dir, `ctime_${stamp}.json`)
  const psPath = path.join(dir, `ctime_${stamp}.ps1`)

  await fsp.writeFile(jsonPath, JSON.stringify(items), 'utf8')
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$items = [System.IO.File]::ReadAllText('${jsonPath.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8) | ConvertFrom-Json`,
    'foreach ($it in $items) {',
    '  $dt = [datetimeoffset]::Parse($it.isoUtc, [System.Globalization.CultureInfo]::InvariantCulture).LocalDateTime',
    '  [System.IO.File]::SetCreationTime($it.path, $dt)',
    '}',
    "'CK_CTIME_OK'"
  ].join('\r\n')
  // BOM so Windows PowerShell 5.1 reads the script as UTF-8
  await fsp.writeFile(psPath, '\ufeff' + script, 'utf8')

  const r = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { windowsHide: true }
    )
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr }))
  })

  await fsp.unlink(jsonPath).catch(() => {})
  await fsp.unlink(psPath).catch(() => {})

  if (r.code !== 0) {
    throw new Error(`PowerShell failed: ${r.stderr.slice(0, 300)}`)
  }

  const results: CreationTimeResult[] = []
  for (const it of items) {
    try {
      const st = await fsp.stat(it.path)
      const want = new Date(it.isoUtc).getTime()
      const ok = Math.abs(st.birthtimeMs - want) < 1500
      results.push({ path: it.path, ok, error: ok ? undefined : 'creation time not applied' })
    } catch (e: any) {
      results.push({ path: it.path, ok: false, error: String(e?.message ?? e) })
    }
  }
  return results
}
