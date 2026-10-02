import { spawn, type ChildProcess } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { shellThumbDir, tmpDir } from './paths'

/**
 * Windows shell thumbnails. Instead of extracting frames with ffmpeg, ask
 * the shell (IShellItemImageFactory, SIIGBF_THUMBNAILONLY) for the thumbnail
 * Explorer already knows — the system generates and caches these itself.
 * PNGs land in the shell-thumb cache and are served to the renderer through
 * the ck-thumb:// protocol, so no image data ever crosses IPC.
 *
 * One persistent PowerShell worker handles all requests: the interop type is
 * compiled once per app run, batches are coalesced, and requests/replies are
 * pure printable ASCII on stdio (non-ASCII path chars travel as \uXXXX JSON
 * escapes), so console codepages cannot corrupt them.
 */

const THUMB_SIZE = 256
const FLUSH_MS = 80
const REQUEST_TIMEOUT_MS = 30_000
const MISS_CACHE_MAX = 2000

interface QueueItem {
  key: string
  path: string
  resolve: (url: string | null) => void
}

interface ReplyWaiter {
  keys: Map<string, (ok: boolean) => void>
  timer: NodeJS.Timeout
}

const queue: QueueItem[] = []
let flushTimer: NodeJS.Timeout | null = null
const pending = new Map<number, ReplyWaiter>()
let nextReqId = 1

const misses = new Set<string>()
let worker: ChildProcess | null = null
let workerBooted = false

function thumbUrl(key: string): string {
  return `ck-thumb://${key}`
}

function cacheFileFor(key: string): string {
  return path.join(shellThumbDir(), `${key}.png`)
}

function psScriptPath(): string {
  return path.join(tmpDir(), 'shellthumb.ps1')
}

/** Escape non-ASCII chars as JSON \uXXXX so stdio stays codepage-safe. */
function toAscii(json: string): string {
  return json.replace(/[\u007f-\uffff]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

function writePsScript(): void {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Drawing',
    "$src = @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    '',
    '[StructLayout(LayoutKind.Sequential)]',
    'public struct CKSIZE { public int cx; public int cy; }',
    '',
    '[ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
    'public interface IShellItemImageFactory {',
    '    void GetImage(CKSIZE size, uint flags, out IntPtr phbm);',
    '}',
    '',
    'public static class CKShell {',
    '    [DllImport("gdi32.dll")]',
    '    private static extern bool DeleteObject(IntPtr h);',
    '',
    '    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]',
    '    private static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);',
    '',
    '    public static void SaveThumbnail(string path, int cx, int cy, string outFile) {',
    '        Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");',
    '        IShellItemImageFactory factory;',
    '        SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out factory);',
    '        CKSIZE s; s.cx = cx; s.cy = cy;',
    '        IntPtr hbm;',
    '        factory.GetImage(s, 8, out hbm); // 8 = SIIGBF_THUMBNAILONLY',
    '        try {',
    '            using (System.Drawing.Bitmap bmp = System.Drawing.Image.FromHbitmap(hbm)) {',
    '                bmp.Save(outFile, System.Drawing.Imaging.ImageFormat.Png);',
    '            }',
    '        } finally {',
    '            DeleteObject(hbm);',
    '        }',
    '    }',
    '}',
    "'@",
    "Add-Type -TypeDefinition $src -ReferencedAssemblies 'System.Drawing'",
    '',
    'while ($true) {',
    '  $line = [Console]::In.ReadLine()',
    '  if ($null -eq $line) { break }',
    '  if ($line.Length -eq 0) { continue }',
    '  $req = $line | ConvertFrom-Json',
    '  $keys = @()',
    '  $oks = @()',
    '  foreach ($it in $req.items) {',
    '    $ok = $false',
    '    try {',
    '      [CKShell]::SaveThumbnail($it.path, $it.w, $it.h, $it.outFile)',
    "      $ok = Test-Path -LiteralPath $it.outFile",
    '    } catch { }',
    '    $keys += $it.key',
    '    $oks += [int]$ok',
    '  }',
    '  $resp = @{ id = $req.id; keys = ($keys -join \',\'); oks = ($oks -join \',\') } | ConvertTo-Json -Compress',
    '  [Console]::Out.WriteLine($resp)',
    '  [Console]::Out.Flush()',
    '}'
  ].join('\r\n')
  writeFileSync(psScriptPath(), '\ufeff' + script, 'utf8')
}

function ensureWorker(): ChildProcess | null {
  if (worker && worker.exitCode === null && !worker.killed) return worker
  try {
    if (!workerBooted) {
      mkdirSync(shellThumbDir(), { recursive: true })
      writePsScript()
      workerBooted = true
    }
    worker = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath()],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }
    )
  } catch {
    worker = null
    return null
  }

  let buf = ''
  worker.stdout!.setEncoding('ascii')
  worker.stdout!.on('data', (d: string) => {
    buf += d
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) handleReply(line)
    }
  })
  worker.on('exit', () => {
    failAllPending()
    worker = null
  })
  return worker
}

function handleReply(line: string): void {
  let msg: { id: number; keys?: string; oks?: string }
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const waiter = pending.get(msg.id)
  if (!waiter) return
  pending.delete(msg.id)
  clearTimeout(waiter.timer)
  const keys = (msg.keys ?? '').split(',').filter(Boolean)
  const oks = (msg.oks ?? '').split(',')
  keys.forEach((key, i) => waiter.keys.get(key)?.(oks[i] === '1'))
}

function failAllPending(): void {
  for (const w of pending.values()) {
    clearTimeout(w.timer)
    for (const cb of w.keys.values()) cb(false)
  }
  pending.clear()
}

function flush(): void {
  const items = queue.splice(0, queue.length)
  if (!items.length) return

  const w = ensureWorker()
  if (!w || !w.stdin || w.stdin.destroyed) {
    for (const it of items) {
      misses.add(it.key)
      it.resolve(null)
    }
    return
  }

  const waiter = new Map<string, (ok: boolean) => void>()
  const reqItems = items.map((it) => {
    waiter.set(it.key, (ok) => {
      if (ok) it.resolve(thumbUrl(it.key))
      else {
        if (misses.size > MISS_CACHE_MAX) misses.clear()
        misses.add(it.key)
        it.resolve(null)
      }
    })
    return { key: it.key, path: it.path, w: THUMB_SIZE, h: THUMB_SIZE, outFile: cacheFileFor(it.key) }
  })

  const id = nextReqId++
  const timer = setTimeout(() => {
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    for (const cb of p.keys.values()) cb(false)
  }, REQUEST_TIMEOUT_MS)
  pending.set(id, { keys: waiter, timer })

  const payload = toAscii(JSON.stringify({ id, items: reqItems }))
  w.stdin.write(`${payload}\n`, (err) => {
    if (!err) return
    const p = pending.get(id)
    if (p) {
      pending.delete(id)
      clearTimeout(p.timer)
      for (const cb of p.keys.values()) cb(false)
    }
  })
}

/** Resolve a ck-thumb:// URL for the file's shell thumbnail, or null. */
export function getShellThumbUrl(file: string, size: number, mtimeMs: number): Promise<string | null> {
  const key = createHash('md5')
    .update(`${file}|${size}|${Math.round(mtimeMs)}`)
    .digest('hex')
  if (existsSync(cacheFileFor(key))) return Promise.resolve(thumbUrl(key))
  if (misses.has(key)) return Promise.resolve(null)
  return new Promise((resolve) => {
    queue.push({ key, path: file, resolve })
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        flush()
      }, FLUSH_MS)
    }
  })
}

export function disposeShellThumbWorker(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  failAllPending()
  worker?.kill()
  worker = null
}
