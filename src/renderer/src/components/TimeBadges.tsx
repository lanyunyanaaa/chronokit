import { Tag, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import { formatLocal, parseFfprobeDate } from '@core/time-engine'
import type { VideoItem } from '@renderer/store/appStore'

/** Badges: metadata creation_time (blue) and filename timestamp (purple). */
export default function TimeBadges({ item }: { item: VideoItem }) {
  const { t } = useTranslation()
  const meta = item.creationTimeIso ? parseFfprobeDate(item.creationTimeIso) : null
  const fname = item.filenameTimeIso ? new Date(item.filenameTimeIso) : null

  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {meta ? (
        <Tooltip title={t('time.creationTime')}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {formatLocal(meta)}
          </Tag>
        </Tooltip>
      ) : (
        <Tooltip title={t('time.creationTime')}>
          <Tag color="warning" style={{ marginInlineEnd: 0 }}>
            --
          </Tag>
        </Tooltip>
      )}
      {fname ? (
        <Tooltip title={`${t('time.filename')}${item.filenamePattern ? ` · ${item.filenamePattern}` : ''}`}>
          <Tag color="purple" style={{ marginInlineEnd: 0 }}>
            {formatLocal(fname)}
          </Tag>
        </Tooltip>
      ) : null}
    </span>
  )
}
