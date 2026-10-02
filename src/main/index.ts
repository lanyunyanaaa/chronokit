import { app, BrowserWindow, shell } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { registerIpc } from './ipc'
import { installThumbProtocol, registerThumbSchemePrivileges } from './protocol'
import { disposeShellThumbWorker } from './services/shellThumb'
import { initDataRoot } from './services/paths'

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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
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

  win.on('ready-to-show', () => win.show())
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
  const samples = join(app.getAppPath(), '.data', 'samples')
  const sources = ['VID_20230101_120305.mp4', 'beach_trip.mp4'].map((f) => join(samples, f))
  const targets = ['VID_20230101_120305_copy.mp4', 'beach_trip_converted.mp4'].map((f) =>
    join(samples, f)
  )
  const tools = [sources[0], targets[0], targets[1]]
  const pages = ['sync', 'tools', 'inspector', 'history']

  const js = (code: string): Promise<unknown> =>
    win.webContents.executeJavaScript(code).catch(() => null)
  const shot = async (name: string): Promise<void> => {
    const img = await win.webContents.capturePage()
    writeFileSync(join(shotDir, `${name}.png`), img.toPNG())
  }
  const go = async (page: string): Promise<void> => {
    await js(`window.__ckNavigate('${page}')`)
    // wait until the nav and the rendered page agree — capturePage() can hand
    // back the previous compositor frame if we shoot too early
    for (let i = 0; i < 25; i++) {
      const ready = await js(
        `!!document.querySelector('.ck-nav-item.is-active[data-page="${page}"]') &&
         !!document.querySelector('.ck-pagehead-title')`
      )
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
    await sleep(9000)

    // 3) sync: pairing table with a source and a target picked by hand
    await go('sync')
    await js(
      `const rows = document.querySelectorAll('.ck-file');
       rows[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
       rows[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`
    )
    await sleep(400)
    await shot('sync')

    // 4) tools: list + mode strip, one row selected so the scope hint shows
    await go('tools')
    await selectFirstRow()
    await sleep(400)
    await shot('tools')

    // 5) inspector: load the first fixture through the dev hook
    await go('inspector')
    await js(`window.__ckInspect(${JSON.stringify(sources[0])})`)
    await sleep(1600)
    await shot('inspector')

    // 6) dry-run preview, then really execute so the journal has a record
    await go('sync')
    await js(`document.querySelector('.ck-actionbar .ant-btn-primary')?.click()`)
    await sleep(900)
    await shot('plan-modal')
    await js(`document.querySelector('.ant-modal-footer .ant-btn-primary')?.click()`)
    await sleep(5000)
    await go('history')
    await shot('history')

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
