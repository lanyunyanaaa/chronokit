import { app, BrowserWindow, shell } from 'electron'
import { mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { registerIpc } from './ipc'
import { installThumbProtocol, registerThumbSchemePrivileges } from './protocol'
import { disposeShellThumbWorker } from './services/shellThumb'
import { initDataRoot } from './services/paths'
import { restoreWindowState, saveWindowState } from './services/window-state'

// Keep all app data inside the repo during development
if (!app.isPackaged && !process.env.CK_DATA_DIR) {
  process.env.CK_DATA_DIR = join(app.getAppPath(), '.data')
}

// Must run before app ready
registerThumbSchemePrivileges()

function sendWinState(win: BrowserWindow): void {
  const send = (): void => {
    if (!win.isDestroyed()) win.webContents.send('win:maximized', win.isMaximized())
  }
  win.on('maximize', send)
  win.on('unmaximize', send)
}

function createWindow(): BrowserWindow {
  const restored = restoreWindowState()
  const win = new BrowserWindow({
    width: restored?.width ?? 1440,
    height: restored?.height ?? 900,
    x: restored?.x,
    y: restored?.y,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#f2f4f8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (restored?.maximized) win.maximize()

  win.on('close', () => {
    saveWindowState({ ...win.getNormalBounds(), maximized: win.isMaximized() })
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.on('render-process-gone', (_e, details) => {
    walkLog(`renderer gone: ${details.reason} ${details.exitCode}`)
    console.log('[CK_SHOT] renderer gone:', details.reason, details.exitCode)
  })
  sendWinState(win)
  // keep painting while unfocused (dev screenshot runs capture the live window)
  win.webContents.setBackgroundThrottling(false)

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env.CK_SHOT) void runScreenshots(win)
  return win
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** CK_SHOT walk trace, straight to disk (stdout pipes are buffered). */
function walkLog(msg: string): void {
  try {
    appendFileSync(join(process.env.CK_DATA_DIR ?? '.data', 'walk.log'), `${new Date().toISOString()} ${msg}\n`)
  } catch {
    /* ignore */
  }
}

/**
 * Dev tool: CK_SHOT=1 walks every page (empty state first, then with the
 * .data/samples fixtures loaded), captures each to .data/shots/ and exits.
 * Shots land as `<page>.png` (loaded) and `empty-<page>.png` (cold), plus
 * `plan-modal.png` for the dry-run preview.
 */
async function runScreenshots(win: BrowserWindow): Promise<void> {
  await sleep(2500)
  const shotDir = join(process.env.CK_DATA_DIR ?? '.data', 'shots')
  mkdirSync(shotDir, { recursive: true })
  const samples =
    process.env.CK_SAMPLES_DIR ?? join(app.getAppPath(), '.data', 'samples')
  const sources = ['VID_20230101_120305.mp4', 'beach_trip.mp4'].map((f) => join(samples, f))
  const targets = ['VID_20230101_120305_copy.mp4', 'beach_trip_converted.mp4'].map((f) =>
    join(samples, f)
  )
  const tools = [sources[0], targets[0], targets[1]]
  // one metadata-less copy so the checkup page has something to report (R1).
  // NOTE: photos (IMG_*.jpg with injected EXIF) stay in .data/samples for the
  // U2a photo pipeline, but are not part of the walk — the shell thumbnail
  // worker stalls the capture on first-generation thumbnails.
  const checkupFiles = [...sources, ...targets, join(samples, 'beach_trip_nometadata.mp4')]
  const table = [...sources, ...targets]
  const rename = [join(samples, 'beach_trip_nometadata.mp4'), ...sources]
  const pages = [
    'checkup', 'sync', 'tools', 'table', 'rename', 'inspector', 'backups', 'history'
  ]

  const js = (code: string): Promise<unknown> =>
    win.webContents.executeJavaScript(code).catch((err) => {
      console.log('[CK_SHOT] js error:', String(err))
      return null
    })
  const shot = async (name: string): Promise<void> => {
    walkLog(`shot ${name} begin`)
    const img = await win.webContents.capturePage()
    writeFileSync(join(shotDir, `${name}.png`), img.toPNG())
    walkLog(`shot ${name} done`)
  }
  const go = async (page: string): Promise<void> => {
    const nav = await js(`window.__ckNavigate('${page}')`)
    walkLog(`nav ${page} -> ${JSON.stringify(nav)}`)
    // wait until the nav and the rendered page agree — capturePage() can hand
    // back the previous compositor frame if we shoot too early
    for (let i = 0; i < 25; i++) {
      const ready = await js(
        `!!document.querySelector('.ck-nav-item.is-active[data-page="${page}"]') &&
         !!document.querySelector('.ck-pagehead-title')`
      )
      if (i === 0) walkLog(`poll ${page} #0 -> ${JSON.stringify(ready)}`)
      if (ready === true) break
      await sleep(200)
    }
    await sleep(700)
  }
  /** Click the first row of each media list on the current page. */
  const selectFirstRow = (): Promise<unknown> =>
    js(
      `document.querySelectorAll('.ck-file')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`
    )

  try {
    // 1) cold states
    for (const page of pages) {
      await go(page)
      await shot(`empty-${page}`)
    }

    // 2) fixtures in, then let the probe pipeline settle
    await js(`window.__store.media.getState().addPaths('sources', ${JSON.stringify(sources)})`)
    await js(`window.__store.media.getState().addPaths('targets', ${JSON.stringify(targets)})`)
    await js(`window.__store.media.getState().addPaths('tools', ${JSON.stringify(tools)})`)
    await js(`window.__store.media.getState().addPaths('checkup', ${JSON.stringify(checkupFiles)})`)
    await js(`window.__store.media.getState().addPaths('table', ${JSON.stringify(table)})`)
    await js(`window.__store.media.getState().addPaths('rename', ${JSON.stringify(rename)})`)
    await sleep(9000)

    // 3) checkup: report with the R1 issue expanded so its file detail shows
    await go('checkup')
    console.log('[CK_SHOT] step: checkup page ready')
    await js(
      `document.querySelector('.ck-issue-head')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`
    )
    await sleep(400)
    await shot('checkup')
    console.log('[CK_SHOT] step: checkup shot done')

    // 4) sync: pairing table with a source and a target picked by hand
    await go('sync')
    walkLog('sync: selecting rows')
    await js(
      `const rows = document.querySelectorAll('.ck-file');
       rows[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
       rows[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`
    )
    walkLog('sync: rows selected')
    await sleep(400)
    await shot('sync')

    // 5) tools: list + mode strip, one row selected so the scope hint shows
    await go('tools')
    await selectFirstRow()
    await sleep(400)
    await shot('tools')

    // 6) batch table + rename preview (both render straight from the store)
    await go('table')
    await sleep(600)
    await shot('table')
    await go('rename')
    await sleep(600)
    await shot('rename')

    // 7) inspector: load the first fixture through the dev hook
    await go('inspector')
    await js(`window.__ckInspect(${JSON.stringify(sources[0])})`)
    await sleep(1600)
    await shot('inspector')

    // 8) dry-run preview, then really execute so the journal has a record
    await go('sync')
    await js(`document.querySelector('.ck-actionbar .ant-btn-primary')?.click()`)
    await sleep(900)
    await shot('plan-modal')
    await js(`document.querySelector('.ant-modal-footer .ant-btn-primary')?.click()`)
    await sleep(5000)

    // 9) safety pages after the execution so the journal/backup rows exist
    await go('history')
    await shot('history')
    await go('backups')
    await sleep(600)
    await shot('backups')

    // leave the fixture files as we found them
    await js(
      `(async () => {
         const ops = await window.ckApi.journalList()
         const top = ops[ops.length - 1]
         if (top && top.status === 'done') await window.ckApi.journalUndo(top.id)
       })()`
    )
    await sleep(500)
  } catch {
    /* dev tool: never block quit on a capture failure */
  }
  app.quit()
}

app.whenReady().then(() => {
  initDataRoot()
  installThumbProtocol()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => disposeShellThumbWorker())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
