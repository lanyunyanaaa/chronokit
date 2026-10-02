import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import type { SyncOptions } from '@core/plan'
import { CheckIcon, ClockIcon, ShieldIcon, TagIcon } from './icons'

interface Props {
  value: SyncOptions
  onChange: (v: SyncOptions) => void
  /** ctime is Windows-only; hide it elsewhere. */
  showCtime?: boolean
}

interface Item {
  key: keyof SyncOptions
  label: string
  hint: string
  icon: React.ReactNode
}

/** Write-target picker: which timestamp fields to actually write. Toggle chips
    instead of checkboxes so the current combination reads at a glance. */
export default function OptionBar({ value, onChange, showCtime }: Props) {
  const { t } = useTranslation()
  const items: Item[] = [
    { key: 'metadata', label: t('opt.metadata'), hint: t('sync.optMetadata'), icon: <TagIcon size={13} /> },
    { key: 'mtime', label: t('opt.mtime'), hint: t('sync.optMtime'), icon: <ClockIcon size={13} /> },
    ...(showCtime
      ? [{ key: 'ctime' as const, label: t('opt.ctime'), hint: t('sync.optCtime'), icon: <ShieldIcon size={13} /> }]
      : [])
  ]

  return (
    <div className="ck-toggles" role="group" aria-label={t('common.writeTargets')}>
      {items.map((it) => (
        <Tooltip key={it.key} title={it.hint}>
          <button
            type="button"
            className={`ck-toggle ${value[it.key] ? 'is-on' : ''}`}
            aria-pressed={value[it.key]}
            onClick={() => onChange({ ...value, [it.key]: !value[it.key] })}
          >
            <span className="ck-toggle-mark">{value[it.key] ? <CheckIcon size={9} /> : null}</span>
            {it.icon}
            {it.label}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
