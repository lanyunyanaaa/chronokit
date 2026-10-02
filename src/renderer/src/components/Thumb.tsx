import { useEffect, useRef, useState } from 'react'
import { LoadingOutlined } from '@ant-design/icons'
import { ck } from '@renderer/services/ck'
import type { VideoItem } from '@renderer/store/mediaStore'
import { FilmIcon } from './icons'

interface Props {
  item: VideoItem
  /** Tile width in px; the height follows the 16:9 pitch. */
  size?: number
}

/**
 * Thumbnail tile. The image is the shell's own cached thumbnail, served via
 * ck-thumb:// from the main process. It is only requested when the tile
 * scrolls into view, so importing a big folder never triggers a thumbnail
 * storm for off-screen rows.
 */
export default function Thumb({ item, size = 64 }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const triedRef = useRef(false)

  const fileKey = `${item.path}|${item.size}|${item.mtimeMs}`

  useEffect(() => {
    triedRef.current = false
    setUrl(null)
  }, [fileKey])

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const load = (): void => {
      if (triedRef.current) return
      triedRef.current = true
      ck.getThumb(item.path, item.size, item.mtimeMs, item.durationSec)
        .then((u) => setUrl(u ?? null))
        .catch(() => {})
    }
    if (typeof IntersectionObserver === 'undefined') {
      load()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: '150px' }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, item.durationSec])

  return (
    <div
      ref={holderRef}
      className={`ck-thumb ${url ? '' : 'is-empty'}`}
      style={{ width: size, height: Math.round((size * 9) / 16) }}
    >
      {url ? (
        <img src={url} alt="" />
      ) : item.probing ? (
        <LoadingOutlined spin style={{ fontSize: Math.round(size / 4.5) }} />
      ) : (
        <FilmIcon size={Math.round(size / 3)} />
      )}
    </div>
  )
}
