import { promises as fsp } from 'fs'
import path from 'path'
import type { FileStatInfo } from '@shared/index'
import { SUPPORTED_VIDEO_EXTS } from '@shared/index'

export async function statFiles(paths: string[]): Promise<FileStatInfo[]> {
  const out: FileStatInfo[] = []
  for (const p of paths) {
    try {
      const st = await fsp.stat(p)
      out.push({
        path: p,
        name: path.basename(p),
        size: st.size,
        mtimeMs: st.mtimeMs,
        atimeMs: st.atimeMs,
        birthtimeMs: st.birthtimeMs
      })
    } catch {
      /* skip missing files */
    }
  }
  return out
}

const extSet = new Set(SUPPORTED_VIDEO_EXTS.map((e) => e.toLowerCase()))

/** Expand dropped/selected paths: directories are walked recursively. */
export async function resolveMediaPaths(paths: string[], maxFiles = 5000): Promise<string[]> {
  const out: string[] = []
  const queue = [...paths]
  while (queue.length && out.length < maxFiles) {
    const p = queue.shift()!
    try {
      const st = await fsp.stat(p)
      if (st.isDirectory()) {
        const entries = await fsp.readdir(p, { withFileTypes: true })
        for (const e of entries) {
          if (e.name.startsWith('.')) continue
          queue.push(path.join(p, e.name))
        }
      } else if (extSet.has(path.extname(p).toLowerCase())) {
        out.push(p)
      }
    } catch {
      /* skip missing */
    }
  }
  return out
}
