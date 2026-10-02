/**
 * ChronoKit app icon generator.
 *
 * Renders build/icon.svg to PNG at every size we ship (Electron's Chromium
 * canvas does the rasterizing — no native image deps), writes build/icon.png
 * and assembles build/icon.ico from raw pixel data (32bpp DIB entries, the
 * maximally compatible ICO form).
 *
 * Run: npx electron scripts/gen-icons.mjs
 */
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const buildDir = join(root, 'build')
const svg = readFileSync(join(buildDir, 'icon.svg'), 'utf8')

// ICO entries: BMP for everything incl. 256 (safe on every shell since XP)
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
// standalone PNGs: icon.png for electron-builder fallback / docs
const PNG_SIZES = [32, 128, 256, 512]

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 64, height: 64 })
  await win.loadURL('data:text/html,<body></body>')

  const result = await win.webContents.executeJavaScript(
    `(async () => {
      const svg = ${JSON.stringify(svg)}
      const sizes = ${JSON.stringify([...new Set([...ICO_SIZES, ...PNG_SIZES])])}
      const img = new Image()
      img.src = 'data:image/svg+xml;base64,' + btoa(svg)
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      const out = {}
      for (const size of sizes) {
        const c = document.createElement('canvas')
        c.width = size
        c.height = size
        const ctx = c.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, size, size)
        out[size] = {
          png: c.toDataURL('image/png'),
          rgba: Array.from(ctx.getImageData(0, 0, size, size).data)
        }
      }
      return out
    })()`
  )
  win.destroy()

  const toBuffer = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')

  // --- standalone PNGs ---
  for (const size of PNG_SIZES) {
    writeFileSync(join(buildDir, `icon-${size}.png`), toBuffer(result[size].png))
  }
  writeFileSync(join(buildDir, 'icon.png'), toBuffer(result[256].png))

  // --- ICO assembly ---
  // Each entry: 16-byte directory record + BITMAPINFOHEADER (height doubled:
  // XOR+AND) + 32bpp BGRA rows bottom-up + all-zero AND mask.
  const images = ICO_SIZES.map((size) => {
    const rgba = result[size].rgba
    const stride = Math.ceil(size / 32) * 4
    const maskSize = stride * size
    const xorSize = size * size * 4
    const dib = Buffer.alloc(40 + xorSize + maskSize)
    dib.writeUInt32LE(40, 0) // biSize
    dib.writeInt32LE(size, 4) // biWidth
    dib.writeInt32LE(size * 2, 8) // biHeight (XOR + AND)
    dib.writeUInt16LE(1, 12) // biPlanes
    dib.writeUInt16LE(32, 14) // biBitCount
    dib.writeUInt32LE(0, 16) // BI_RGB
    dib.writeUInt32LE(xorSize + maskSize, 20)
    for (let y = 0; y < size; y++) {
      const srcRow = (size - 1 - y) * size * 4 // bottom-up
      let off = 40 + y * size * 4
      for (let x = 0; x < size; x++) {
        const s = srcRow + x * 4
        dib[off++] = rgba[s + 2] // B
        dib[off++] = rgba[s + 1] // G
        dib[off++] = rgba[s] // R
        dib[off++] = rgba[s + 3] // A
      }
    }
    // AND mask stays zero: alpha channel decides transparency
    return { size, data: dib }
  })

  const headerSize = 6 + images.length * 16
  const total = headerSize + images.reduce((n, im) => n + im.data.length, 0)
  const ico = Buffer.alloc(total)
  ico.writeUInt16LE(0, 0)
  ico.writeUInt16LE(1, 2) // icon type
  ico.writeUInt16LE(images.length, 4)
  let offset = headerSize
  images.forEach((im, i) => {
    const e = 6 + i * 16
    ico[e] = im.size % 256
    ico[e + 1] = im.size % 256
    ico.writeUInt16LE(1, e + 4) // planes
    ico.writeUInt16LE(32, e + 6) // bpp
    ico.writeUInt32LE(im.data.length, e + 8)
    ico.writeUInt32LE(offset, e + 12)
    im.data.copy(ico, offset)
    offset += im.data.length
  })
  writeFileSync(join(buildDir, 'icon.ico'), ico)

  console.log(
    `icons: ${ICO_SIZES.join('/')} -> icon.ico (${(total / 1024).toFixed(0)} KB), ` +
      `png ${PNG_SIZES.join('/')}, icon.png 256`
  )
  app.quit()
})
