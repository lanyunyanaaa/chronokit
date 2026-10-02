import { useTranslation } from 'react-i18next'
import { formatLocal, parseFfprobeDate } from '@core/time-engine'
import type { VideoItem } from '@renderer/store/mediaStore'
import { TagIcon, TextLinesIcon } from './icons'

/** Time chips on a media row: metadata creation_time (blue) and the time parsed
    from the filename (purple); a dashed chip marks a missing metadata time. */
export default function TimeBadges({ item }: { item: VideoItem }) {
  const { t } = useTranslation()
  const meta = item.creationTimeIso ? parseFfprobeDate(item.creationTimeIso) : null
  const fname = item.filenameTimeIso ? new Date(item.filenameTimeIso) : null

  return (
    <span className="ck-file-chips">
      {meta ? (
        <span className="ck-chip ck-chip-blue" title={t('time.creationTime')}>
          <TagIcon size={11} />
          {formatLocal(meta)}
        </span>
      ) : (
        <span className="ck-chip ck-chip-dash" title={t('time.creationTime')}>
          {t('common.noTime')}
        </span>
      )}
      {fname && (
        <span
          className="ck-chip ck-chip-purple"
          title={`${t('time.filename')}${item.filenamePattern ? ` · ${item.filenamePattern}` : ''}`}
        >
          <TextLinesIcon size={11} />
          {formatLocal(fname)}
        </span>
      )}
    </span>
  )
}
