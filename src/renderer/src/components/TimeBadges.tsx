import { useTranslation } from 'react-i18next'
import { formatLocal, parseFfprobeDate } from '@core/time-engine'
import type { VideoItem } from '@renderer/store/appStore'

/** Chips: metadata creation_time (blue) and filename timestamp (purple). */
export default function TimeBadges({ item }: { item: VideoItem }) {
  const { t } = useTranslation()
  const meta = item.creationTimeIso ? parseFfprobeDate(item.creationTimeIso) : null
  const fname = item.filenameTimeIso ? new Date(item.filenameTimeIso) : null

  return (
    <span className="ck-file-chips">
      {meta ? (
        <span className="ck-chip ck-chip-blue" title={t('time.creationTime')}>
          {formatLocal(meta)}
        </span>
      ) : (
        <span className="ck-chip ck-chip-warn" title={t('time.creationTime')}>
          --:--:--
        </span>
      )}
      {fname ? (
        <span
          className="ck-chip ck-chip-purple"
          title={`${t('time.filename')}${item.filenamePattern ? ` · ${item.filenamePattern}` : ''}`}
        >
          {formatLocal(fname)}
        </span>
      ) : null}
    </span>
  )
}
