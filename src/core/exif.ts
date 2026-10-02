/**
 * Minimal EXIF reader for photos (U2a, read-only). Understands:
 *  - JPEG APP1 "Exif" segments
 *  - PNG eXIf chunks
 *  - the embedded TIFF structure: IFD0 -> Exif SubIFD
 *
 * Only what ChronoKit needs: DateTimeOriginal/CreateDate (+ optional
 * OffsetTimeOriginal), falling back to IFD0 ModifyDate. Naive timestamps are
 * treated as UTC to match the ffmpeg container convention used everywhere
 * else in the pipeline. Offsets (+08:00) shift the stamp to UTC.
 */

const EXIF_ASCII = 2
const EXIF_LONG = 4

interface TiffView {
  le: boolean
  data: DataView
}

function u16(t: TiffView, off: number): number {
  return t.data.getUint16(off, t.le)
}
function u32(t: TiffView, off: number): number {
  return t.data.getUint32(off, t.le)
}

function parseTiffDate(s: string, offset?: string): string | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, sec] = m
  const tz = offset && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : 'Z'
  const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}${tz}`)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function readAscii(t: TiffView, entryOff: number): string | null {
  const len = u32(t, entryOff + 4)
  if (!len) return null
  // values ≤ 4 bytes are stored inline in the entry, larger ones are offsets
  const valOff = len <= 4 ? entryOff + 8 : u32(t, entryOff + 8)
  if (valOff < 0 || valOff + len > t.data.byteLength) return null
  const raw = new Uint8Array(t.data.buffer, t.data.byteOffset + valOff, len - 1)
  return new TextDecoder('ascii').decode(raw)
}

/** Walk one IFD; returns tag -> raw entry offset inside the TIFF blob. */
function readIfd(t: TiffView, ifdOff: number): Map<number, number> {
  const entries = new Map<number, number>()
  if (ifdOff + 2 > t.data.byteLength) return entries
  const count = u16(t, ifdOff)
  if (ifdOff + 2 + count * 12 > t.data.byteLength) return entries
  for (let i = 0; i < count; i++) {
    const entryOff = ifdOff + 2 + i * 12
    entries.set(u16(t, entryOff), entryOff)
  }
  return entries
}

/** Extract the UTC ISO creation time from a TIFF blob, or null. */
export function exifCreationTimeFromTiff(buf: ArrayBuffer): string | null {
  if (buf.byteLength < 8) return null
  const view = new DataView(buf)
  const order = buf.byteLength >= 2 && view.getUint16(0, false)
  let t: TiffView | null = null
  if (order === 0x4949) t = { le: true, data: view }
  else if (order === 0x4d4d) t = { le: false, data: view }
  if (!t || u16(t, 2) !== 42) return null

  const ifd0 = readIfd(t, u32(t, 4))
  const utc = (dateEntry: number | undefined, offsetEntry: number | undefined): string | null => {
    if (!dateEntry) return null
    const dateStr = readAscii(t!, dateEntry)
    const offsetStr = offsetEntry ? readAscii(t!, offsetEntry) : undefined
    return dateStr ? parseTiffDate(dateStr, offsetStr ?? undefined) : null
  }

  // preferred: DateTimeOriginal / OffsetTimeOriginal in the Exif SubIFD
  const exifPtr = ifd0.get(0x8769)
  if (exifPtr != null) {
    const exif = readIfd(t, u32(t, exifPtr + 8))
    const iso =
      utc(exif.get(0x9003), exif.get(0x9011)) ?? // DateTimeOriginal + OffsetTimeOriginal
      utc(exif.get(0x9004), exif.get(0x9011)) // CreateDate
    if (iso) return iso
  }
  // fallback: ModifyDate in IFD0
  return utc(ifd0.get(0x0132), ifd0.get(0x9010))
}

/** Find the TIFF blob inside a JPEG file buffer, or null. */
function jpegTiffBlob(buf: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(buf)
  if (view.getUint16(0, false) !== 0xffd8) return null
  let off = 2
  while (off + 4 <= buf.byteLength) {
    if (view.getUint8(off) !== 0xff) break
    const marker = view.getUint8(off + 1)
    if (marker === 0xda || marker === 0xd9) break // SOS / EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2
      continue
    }
    const len = view.getUint16(off + 2, false)
    if (marker === 0xe1 && len >= 8) {
      // APP1: "Exif\0\0" then TIFF
      const sig = new Uint8Array(buf, off + 4, 4)
      if (
        sig[0] === 0x45 && sig[1] === 0x78 && sig[2] === 0x69 && sig[3] === 0x66 &&
        view.getUint16(off + 8, false) === 0
      ) {
        return buf.slice(off + 10, off + 2 + len)
      }
    }
    off += 2 + len
  }
  return null
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Find the TIFF blob inside a PNG eXIf chunk, or null. */
function pngTiffBlob(buf: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(buf)
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== PNG_SIG[i]) return null
  }
  let off = 8
  while (off + 12 <= buf.byteLength) {
    const len = view.getUint32(off, false)
    const type = String.fromCharCode(
      view.getUint8(off + 4), view.getUint8(off + 5), view.getUint8(off + 6), view.getUint8(off + 7)
    )
    if (type === 'eXIf') return buf.slice(off + 8, off + 8 + len)
    off += 12 + len
    if (type === 'IEND') break
  }
  return null
}

export interface ExifResult {
  isoUtc: string
  tags: Record<string, string>
}

/**
 * Read the creation time from a photo file's EXIF. Returns null when the
 * container isn't JPEG/PNG or carries no usable timestamps.
 */
export function readExifCreationTime(buf: ArrayBuffer, ext: string): ExifResult | null {
  const tiff =
    ext === '.jpg' || ext === '.jpeg'
      ? jpegTiffBlob(buf)
      : ext === '.png'
        ? pngTiffBlob(buf)
        : null
  if (!tiff) return null
  const isoUtc = exifCreationTimeFromTiff(tiff)
  return isoUtc ? { isoUtc, tags: { DateTimeOriginal: isoUtc } } : null
}
