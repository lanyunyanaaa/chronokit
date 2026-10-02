import { promises as fsp } from 'fs'
import path from 'path'
import { protocol } from 'electron'
import { shellThumbDir } from './services/paths'

const HASH_RE = /^[a-f0-9]{32}$/

/**
 * ck-thumb://<md5> serves shell thumbnail PNGs straight from the main-process
 * cache, so images never travel through IPC as data URLs.
 */
export function registerThumbSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'ck-thumb', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** Call after app ready. Only ever serves <32-hex>.png from the cache dir. */
export function installThumbProtocol(): void {
  protocol.handle('ck-thumb', async (request) => {
    try {
      const key = new URL(request.url).hostname
      if (!HASH_RE.test(key)) return new Response(null, { status: 400 })
      const data = await fsp.readFile(path.join(shellThumbDir(), `${key}.png`))
      return new Response(new Uint8Array(data), {
        headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}
