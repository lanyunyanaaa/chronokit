import { memo, useMemo, useRef, type MouseEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LoadingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMediaItem } from '@renderer/store/mediaStore'
import { formatDuration, formatSize } from '@renderer/utils/format'
import { layout } from '@renderer/tokens'
import Thumb from './Thumb'
import TimeBadges from './TimeBadges'
import { AlertIcon, CloseIcon } from './icons'

/** Row pitch in px: 56px card + 8px gap (mirrored in styles.css). */
export const MEDIA_ROW_HEIGHT = layout.rowH

interface RowProps {
  path: string
  selected: boolean
  onClick: (path: string, e: MouseEvent) => void
  onRemove?: (path: string) => void
}

const MediaRow = memo(function MediaRow({ path, selected, onClick, onRemove }: RowProps) {
  const { t } = useTranslation()
  const item = useMediaItem(path)
  if (!item) return null
  const dur = item.durationSec ? formatDuration(item.durationSec) : ''
  return (
    <div
      className={`ck-file ${selected ? 'is-selected' : ''}`}
      title={item.path}
      role="option"
      aria-selected={selected}
      onClick={(e) => onClick(path, e)}
    >
      <Thumb item={item} />
      <div className="ck-file-info">
        <div className="ck-file-top">
          <span className="ck-file-name">{item.name}</span>
          <span className="ck-row-actions">
            {onRemove && (
              <button
                type="button"
                className="ck-icon-btn is-danger"
                title={t('common.remove')}
                aria-label={t('common.remove')}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(path)
                }}
              >
                <CloseIcon size={13} />
              </button>
            )}
          </span>
        </div>
        <div className="ck-file-bottom">
          <span className="ck-file-meta">
            {formatSize(item.size)}
            {dur ? ` · ${dur}` : ''}
          </span>
          {item.probing && <LoadingOutlined spin className="ck-faint" style={{ fontSize: 11 }} />}
          {item.probeFailed && (
            <span className="ck-warn-text" title={t('inspector.probeFailed')}>
              <AlertIcon size={13} />
            </span>
          )}
          <TimeBadges item={item} />
        </div>
      </div>
    </div>
  )
})

interface Props {
  paths: string[]
  selectedPaths: string[]
  /** Selection is resolved here (click / ctrl+click / shift+click), the owner
      only stores the resulting path list. */
  onSelectionChange: (paths: string[]) => void
  onRemove?: (path: string) => void
  /** Grow to the parent's height instead of a bounded scroll box. */
  fill?: boolean
  /** Bounded viewport height so the list scrolls internally. */
  maxHeight?: number
}

/**
 * Virtualized media file list (fixed row height). Only rows in/near the
 * viewport mount, which also rate-limits thumbnail requests for huge folders.
 * Selection follows the familiar file-manager model: plain click selects one,
 * ctrl/cmd-click toggles, shift-click extends from the last anchor.
 */
export default function MediaList({
  paths,
  selectedPaths,
  onSelectionChange,
  onRemove,
  fill,
  maxHeight = 268
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<string | null>(null)
  const selected = useMemo(() => new Set(selectedPaths), [selectedPaths])

  const virtualizer = useVirtualizer({
    count: paths.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => MEDIA_ROW_HEIGHT,
    overscan: 6
  })

  const handleClick = (path: string, e: MouseEvent): void => {
    if (e.shiftKey && anchorRef.current) {
      const from = paths.indexOf(anchorRef.current)
      const to = paths.indexOf(path)
      if (from >= 0 && to >= 0) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        onSelectionChange(paths.slice(lo, hi + 1))
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      onSelectionChange(
        selected.has(path) ? selectedPaths.filter((p) => p !== path) : [...selectedPaths, path]
      )
      anchorRef.current = path
      return
    }
    onSelectionChange([path])
    anchorRef.current = path
  }

  return (
    <div
      ref={scrollRef}
      className={`ck-media-scroll ${fill ? 'is-fill' : ''}`}
      style={fill ? undefined : { maxHeight }}
      role="listbox"
      aria-multiselectable
    >
      <div className="ck-media-spacer" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={paths[vi.index]}
            className="ck-media-row"
            style={{ transform: `translateY(${vi.start}px)` }}
          >
            <MediaRow
              path={paths[vi.index]}
              selected={selected.has(paths[vi.index])}
              onClick={handleClick}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
