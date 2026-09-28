import { useEffect, useState } from 'react'
import { ClockCircleOutlined, EyeOutlined, HistoryOutlined, SwapOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@renderer/store/appStore'
import { ck } from '@renderer/services/ck'

export default function SideNav() {
  const { t } = useTranslation()
  const activePage = useAppStore((s) => s.activePage)
  const setPage = useAppStore((s) => s.setPage)
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null)

  useEffect(() => {
    void ck
      .appInfo()
      .then((info) => setFfmpegOk(!info.ffmpegError))
      .catch(() => setFfmpegOk(false))
  }, [])

  const items = [
    { key: 'sync', icon: <SwapOutlined />, label: t('menu.sync') },
    { key: 'tools', icon: <ClockCircleOutlined />, label: t('menu.tools') },
    { key: 'inspector', icon: <EyeOutlined />, label: t('menu.inspector') },
    { key: 'history', icon: <HistoryOutlined />, label: t('menu.history') }
  ]

  return (
    <aside className="ck-sidenav">
      <nav>
        {items.map((it) => (
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
      </nav>
      <div className="ck-sidenav-foot" title={t('status.ffmpeg')}>
        <span className={`ck-status-dot ${ffmpegOk === false ? 'is-bad' : ''}`} />
        <span>{ffmpegOk === false ? t('status.ffmpegBad') : t('status.ffmpegOk')}</span>
      </div>
    </aside>
  )
}
