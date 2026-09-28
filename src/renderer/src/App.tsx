import { useEffect } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import { darkTheme } from './theme'
import { persistLang, type Lang } from './i18n'
import { useAppStore } from './store/appStore'
import TitleBar from './components/TitleBar'
import SideNav from './components/SideNav'
import SyncPage from './pages/SyncPage'
import TimeToolsPage from './pages/TimeToolsPage'
import InspectorPage from './pages/InspectorPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  const { t, i18n } = useTranslation()
  const activePage = useAppStore((s) => s.activePage)

  useEffect(() => {
    const off = window.ckApi.onTaskProgress((p) => useAppStore.getState().setProgress(p))
    return off
  }, [])

  useEffect(() => {
    // Dev-only automation hooks (screenshot mode)
    ;(window as any).__store = useAppStore
    ;(window as any).__ckNavigate = (p: string) => useAppStore.getState().setPage(p)
  }, [])

  return (
    <ConfigProvider locale={i18n.language === 'en' ? enUS : zhCN} theme={darkTheme}>
      <AntdApp>
        <div className="ck-shell">
          <TitleBar />
          <div className="ck-body">
            <SideNav />
            <main className="ck-main">
              {activePage === 'sync' && <SyncPage />}
              {activePage === 'tools' && <TimeToolsPage />}
              {activePage === 'inspector' && <InspectorPage />}
              {activePage === 'history' && <HistoryPage />}
            </main>
          </div>
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}
