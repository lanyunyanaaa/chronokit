import { describe, expect, it } from 'vitest'
import { exifCreationTimeFromTiff, readExifCreationTime } from '../exif'

/**
 * Build a minimal little-endian TIFF blob with IFD0 -> Exif SubIFD carrying
 * DateTimeOriginal + OffsetTimeOriginal (and optionally ModifyDate).
 */
function buildTiff(opts: {
  le?: boolean
  dateTimeOriginal?: string
  offsetOriginal?: string
  modifyDate?: string
}): ArrayBuffer {
  const le = opts.le ?? true
  const ascii = (s: string): { bytes: Uint8Array } => ({
    bytes: new TextEncoder().encode(s + '\0')
  })
  const dto = opts.dateTimeOriginal ? ascii(opts.dateTimeOriginal) : null
  const off = opts.offsetOriginal ? ascii(opts.offsetOriginal) : null
  const mod = opts.modifyDate ? ascii(opts.modifyDate) : null

  // layout: header(8) | IFD0 (2 + 12*n + 4) | exifIFD (2 + 12*n + 4) | strings
  const ifd0Count = mod ? 2 : opts.dateTimeOriginal ? 1 : 0 // ModifyDate + ExifIFD ptr | ExifIFD ptr
  const exifCount = (dto ? 1 : 0) + (off ? 1 : 0)
  const ifd0Off = 8
  const exifOff = ifd0Off + 2 + ifd0Count * 12 + 4
  const stringsOff = exifOff + 2 + exifCount * 12 + 4

  const size = stringsOff + 64
  const buf = new ArrayBuffer(size)
  const view = new DataView(buf)
  let p = 0
  const w16 = (v: number): void => {
    if (le) view.setUint16(p, v, true)
    else view.setUint16(p, v, false)
    p += 2
  }
  const w32 = (v: number): void => {
    if (le) view.setUint32(p, v, true)
    else view.setUint32(p, v, false)
    p += 4
  }
  const raw = (bytes: Uint8Array): void => {
    new Uint8Array(buf, p, bytes.length).set(bytes)
    p += bytes.length
  }

  w16(le ? 0x4949 : 0x4d4d)
  w16(42)
  w32(ifd0Off)

  p = ifd0Off
  w16(ifd0Count)
  if (mod) {
    w16(0x0132)
    w16(2) // ASCII
    w32(mod.bytes.length)
    w32(stringsOff + 32)
  }
  w16(0x8769) // Exif IFD pointer
  w16(4) // LONG
  w32(1)
  w32(exifOff)
  w32(0) // next IFD

  p = exifOff
  w16(exifCount)
  if (dto) {
    w16(0x9003)
    w16(2)
    w32(dto.bytes.length)
    w32(stringsOff)
  }
  if (off) {
    w16(0x9011)
    w16(2)
    w32(off.bytes.length)
    w32(stringsOff + 24)
  }
  w32(0)

  p = stringsOff
  if (dto) raw(dto.bytes)
  p = stringsOff + 24
  if (off) raw(off.bytes)
  p = stringsOff + 32
  if (mod) raw(mod.bytes)

  return buf
}

function buildJpeg(tiff: ArrayBuffer): ArrayBuffer {
  const segLen = tiff.byteLength + 8
  const out = new ArrayBuffer(2 + 2 + segLen + 2)
  const v = new DataView(out)
  v.setUint16(0, 0xffd8, false) // SOI
  v.setUint8(2, 0xff)
  v.setUint8(3, 0xe1) // APP1
  v.setUint16(4, segLen, false)
  new Uint8Array(out, 6, 4).set(new TextEncoder().encode('Exif'))
  v.setUint16(10, 0, false) // "Exif\0\0"
  new Uint8Array(out, 12, tiff.byteLength).set(new Uint8Array(tiff))
  v.setUint16(2 + 2 + segLen, 0xffd9, false) // EOI
  return out
}

function buildPng(tiff: ArrayBuffer): ArrayBuffer {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const out = new ArrayBuffer(8 + 12 + 13 + 4 + 12 + tiff.byteLength + 12)
  const v = new DataView(out)
  sig.forEach((b, i) => v.setUint8(i, b))
  let p = 8
  v.setUint32(p, 13, false)
  v.setUint8(p + 4, 0x49) // IHDR
  v.setUint8(p + 5, 0x48)
  v.setUint8(p + 6, 0x44)
  v.setUint8(p + 7, 0x52)
  p += 12 + 13 // len+type+crc + IHDR data
  v.setUint32(p, tiff.byteLength, false)
  v.setUint8(p + 4, 0x65) // eXIf
  v.setUint8(p + 5, 0x58)
  v.setUint8(p + 6, 0x49)
  v.setUint8(p + 7, 0x66)
  new Uint8Array(out, p + 8, tiff.byteLength).set(new Uint8Array(tiff))
  return out
}

describe('exifCreationTimeFromTiff', () => {
  it('reads DateTimeOriginal + OffsetTimeOriginal and converts to UTC', () => {
    const tiff = buildTiff({
      dateTimeOriginal: '2023:06:15 10:30:00',
      offsetOriginal: '+08:00'
    })
    expect(exifCreationTimeFromTiff(tiff)).toBe('2023-06-15T02:30:00.000Z')
  })

  it('handles big-endian TIFF and negative offsets', () => {
    const tiff = buildTiff({
      le: false,
      dateTimeOriginal: '2023:06:15 10:30:00',
      offsetOriginal: '-05:30'
    })
    expect(exifCreationTimeFromTiff(tiff)).toBe('2023-06-15T16:00:00.000Z')
  })

  it('treats a naive stamp as UTC (ffmpeg convention)', () => {
    const tiff = buildTiff({ dateTimeOriginal: '2023:06:15 10:30:00' })
    expect(exifCreationTimeFromTiff(tiff)).toBe('2023-06-15T10:30:00.000Z')
  })

  it('falls back to ModifyDate in IFD0', () => {
    const tiff = buildTiff({ modifyDate: '2024:01:02 03:04:05' })
    expect(exifCreationTimeFromTiff(tiff)).toBe('2024-01-02T03:04:05.000Z')
  })

  it('rejects garbage', () => {
    expect(exifCreationTimeFromTiff(new ArrayBuffer(4))).toBeNull()
  })
})

describe('readExifCreationTime', () => {
  it('finds the APP1 Exif segment in a JPEG', () => {
    const r = readExifCreationTime(
      buildJpeg(buildTiff({ dateTimeOriginal: '2023:06:15 10:30:00' })),
      '.jpg'
    )
    expect(r?.isoUtc).toBe('2023-06-15T10:30:00.000Z')
  })

  it('finds the eXIf chunk in a PNG', () => {
    const r = readExifCreationTime(
      buildPng(buildTiff({ dateTimeOriginal: '2023:01:01 00:01:02', offsetOriginal: '+02:00' })),
      '.png'
    )
    expect(r?.isoUtc).toBe('2022-12-31T22:01:02.000Z')
  })

  it('returns null for photos without EXIF and unknown extensions', () => {
    const bare = new ArrayBuffer(64)
    new DataView(bare).setUint16(0, 0xffd8, false)
    expect(readExifCreationTime(bare, '.jpg')).toBeNull()
    expect(readExifCreationTime(buildJpeg(buildTiff({})), '.jpg')).toBeNull()
    expect(readExifCreationTime(bare, '.heic')).toBeNull()
  })
})
