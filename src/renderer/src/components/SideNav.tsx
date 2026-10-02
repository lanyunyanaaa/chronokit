import { useTranslation } from 'react-i18next'
import type { PageKey } from '@renderer/store/navStore'
import { useNavStore } from '@renderer/store/navStore'
import { useAppInfo } from '@renderer/hooks/useAppInfo'
import type { ReactNode } from 'react'
import { HistoryIcon, HealthIcon, InspectorIcon, ShieldIcon, SyncIcon, TableIcon, TagIcon, ToolsIcon } from './icons'

interface NavEntry {
  key: PageKey
  icon: ReactNode
  label: string
}

/** Nav rail, grouped by workflow stage: discover → fix → safety. */
export default function SideNav() {
  const { t } = useTranslation()
  const activePage = useNavStore((s) => s.activePage)
  const setPage = useNavStore((s) => s.setPage)
  const info = useAppInfo()

  const groups: { key: string; items: NavEntry[] }[] = [
    {
      key: 'discover',
      items: [
        { key: 'checkup', icon: <HealthIcon size={18} />, label: t('menu.checkup') },
        { key: 'inspector', icon: <InspectorIcon size={18} />, label: t('menu.inspector') }
      ]
    },
    {
      key: 'fix',
      items: [
        { key: 'sync', icon: <SyncIcon size={18} />, label: t('menu.sync') },
        { key: 'tools', icon: <ToolsIcon size={18} />, label: t('menu.tools') },
        { key: 'table', icon: <TableIcon size={18} />, label: t('menu.table') },
        { key: 'rename', icon: <TagIcon size={18} />, label: t('menu.rename') }
      ]
    },
    {
      key: 'safety',
      items: [
        { key: 'backups', icon: <ShieldIcon size={18} />, label: t('menu.backups') },
        { key: 'history', icon: <HistoryIcon size={18} />, label: t('menu.history') }
      ]
    }
  ]

  const ffmpegBad = info ? !!info.ffmpegError : false

  return (
    <aside className="ck-sidenav">
      <nav>
        {groups.map((g) => (
          <div key={g.key}>
            <div className="ck-nav-group">{t(`menu.group.${g.key}`)}</div>
            {g.items.map((it) => (
              <button
                key={it.key}
                data-page={it.key}
                className={`ck-nav-item ${activePage === it.key ? 'is-active' : ''}`}
                onClick={() => setPage(it.key)}
              >
                <span className="ck-nav-icon">{it.icon}</span>
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="ck-nav-foot" title={info?.dataRoot ?? undefined}>
        <span className={`ck-status-dot ${ffmpegBad ? 'is-bad' : ''}`} />
        <span className="ck-truncate">{ffmpegBad ? t('status.ffmpegBad') : t('status.ffmpegOk')}</span>
      </div>
    </aside>
  )
}
