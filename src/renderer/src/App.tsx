import { useEffect } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import { lightTheme } from './tokens'
import { useNavStore } from './store/navStore'
import { useTaskStore } from './store/taskStore'
import { useMediaStore } from './store/mediaStore'
// matchStore registers its auto-match hook into mediaStore on first import;
// load it eagerly so pairing works no matter which page starts first.
import './store/matchStore'
import { PageOutlet } from './pages/registry'
import TaskStatus from './components/TaskStatus'
import TitleBar from './components/TitleBar'
import SideNav from './components/SideNav'

export default function App() {
  const { i18n } = useTranslation()
  const activePage = useNavStore((s) => s.activePage)

  useEffect(() => {
    const off = window.ckApi.onTaskProgress((p) => useTaskStore.getState().setProgress(p))
    return off
  }, [])

  useEffect(() => {
    // Dev-only automation hooks (screenshot mode)
    ;(window as any).__store = { media: useMediaStore, nav: useNavStore }
    ;(window as any).__ckNavigate = (p: string) => useNavStore.getState().setPage(p as any)
  }, [])

  return (
    <ConfigProvider locale={i18n.language === 'en' ? enUS : zhCN} theme={lightTheme}>
      <AntdApp>
        <div className="ck-shell">
          <TitleBar />
          <div className="ck-body">
            <SideNav />
            <main className="ck-main">
              <PageOutlet page={activePage} />
            </main>
          </div>
          <TaskStatus />
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}
