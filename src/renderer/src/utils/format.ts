/** Byte size in a compact human form: "12 B", "3.4 MB", "1.2 GB". */
export function formatSize(n: number): string {
  let v = n
  for (const u of ['B', 'KB', 'MB', 'GB']) {
    if (v < 1024) return `${v.toFixed(u === 'B' || v >= 100 ? 0 : 1)} ${u}`
    v /= 1024
  }
  return `${v.toFixed(1)} TB`
}

/** Seconds as m:ss or h:mm:ss; empty string for missing/zero input. */
export function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}
