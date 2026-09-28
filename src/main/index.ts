import { app, BrowserWindow, shell } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { registerIpc } from './ipc'
import { initDataRoot } from './services/paths'

// Keep all app data inside the repo during development
if (!app.isPackaged && !process.env.CK_DATA_DIR) {
  process.env.CK_DATA_DIR = join(app.getAppPath(), '.data')
}

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
    backgroundColor: '#0d0f13',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  sendWinState(win)

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

/** Dev tool: CK_SHOT=1 captures each page to .data/shots/ then exits. */
async function runScreenshots(win: BrowserWindow): Promise<void> {
  await sleep(2500)
  const shotDir = join(process.env.CK_DATA_DIR ?? '.data', 'shots')
  mkdirSync(shotDir, { recursive: true })
  const samples = join(app.getAppPath(), '.data', 'samples')
  const sources = ['VID_20230101_120305.mp4', 'beach_trip.mp4'].map((f) => join(samples, f))
  const targets = ['VID_20230101_120305_copy.mp4', 'beach_trip_converted.mp4'].map((f) =>
    join(samples, f)
  )
  try {
    await win.webContents.executeJavaScript(
      `window.__store.getState().addPaths('sources', ${JSON.stringify(sources)});
       window.__store.getState().addPaths('targets', ${JSON.stringify(targets)});`
    )
  } catch {
    /* store bridge missing */
  }
  await sleep(9000)
  for (const page of ['sync', 'tools', 'inspector', 'history']) {
    await win.webContents.executeJavaScript(`window.__ckNavigate('${page}')`).catch(() => {})
    await sleep(1200)
    const img = await win.webContents.capturePage()
    writeFileSync(join(shotDir, `${page}.png`), img.toPNG())
  }
  app.quit()
}

app.whenReady().then(() => {
  initDataRoot()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
