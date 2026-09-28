import { useEffect, useRef } from 'react'
import { ck } from '@renderer/services/ck'
import { useAppStore, type Kind, type VideoItem } from '@renderer/store/appStore'

interface Props {
  item: VideoItem
  kind: Kind
  size?: number
}

export default function Thumb({ item, kind, size = 64 }: Props) {
  const triedRef = useRef(false)

  useEffect(() => {
    if (triedRef.current || item.thumb) return
    triedRef.current = true
    void ck
      .getThumb(item.path, item.durationSec)
      .then((url) => {
        if (url) useAppStore.getState().setThumb(kind, item.path, url)
      })
      .catch(() => {})
  }, [item.path, item.durationSec, item.thumb, kind])

  const h = Math.round((size * 9) / 16)
  if (item.thumb) {
    return (
      <img
        src={item.thumb}
        alt=""
        style={{ width: size, height: h, objectFit: 'cover', borderRadius: 6, background: '#000', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: h,
        borderRadius: 6,
        background: '#2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: 12,
        flexShrink: 0
      }}
    >
      {item.probing ? '…' : '🎬'}
    </div>
  )
}
