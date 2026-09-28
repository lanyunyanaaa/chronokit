import { useEffect, useMemo } from 'react'
import { App as AntdApp, ConfigProvider, Layout, Menu, Select } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { ClockCircleOutlined, EyeOutlined, HistoryOutlined, SwapOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { darkTheme } from './theme'
import { persistLang, type Lang } from './i18n'
import { useAppStore } from './store/appStore'
import SyncPage from './pages/SyncPage'
import TimeToolsPage from './pages/TimeToolsPage'
import InspectorPage from './pages/InspectorPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  const { t, i18n } = useTranslation()
  const activePage = useAppStore((s) => s.activePage)
  const setPage = useAppStore((s) => s.setPage)

  useEffect(() => {
    const off = window.ckApi.onTaskProgress((p) => useAppStore.getState().setProgress(p))
    return off
  }, [])

  const items = useMemo(
    () => [
      { key: 'sync', icon: <SwapOutlined />, label: t('menu.sync') },
      { key: 'tools', icon: <ClockCircleOutlined />, label: t('menu.tools') },
      { key: 'inspector', icon: <EyeOutlined />, label: t('menu.inspector') },
      { key: 'history', icon: <HistoryOutlined />, label: t('menu.history') }
    ],
    [t]
  )

  return (
    <ConfigProvider locale={i18n.language === 'en' ? enUS : zhCN} theme={darkTheme}>
      <AntdApp>
        <Layout style={{ height: '100vh' }}>
          <Layout.Sider width={200} style={{ borderRight: '1px solid #303030' }}>
            <div
              style={{
                padding: '18px 16px 2px',
                fontWeight: 700,
                fontSize: 18,
                color: '#1677ff',
                letterSpacing: 0.5
              }}
            >
              ChronoKit
            </div>
            <div style={{ padding: '0 16px 14px', color: '#8a8a8a', fontSize: 12 }}>
              {t('app.subtitle')}
            </div>
            <Menu
              mode="inline"
              items={items}
              selectedKeys={[activePage]}
              onClick={(e) => setPage(e.key)}
              style={{ borderInlineEnd: 'none' }}
            />
          </Layout.Sider>
          <Layout>
            <Layout.Header
              style={{
                background: '#141414',
                borderBottom: '1px solid #303030',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingInline: 16,
                height: 48,
                minHeight: 48,
                lineHeight: '48px'
              }}
            >
              <Select
                size="small"
                value={i18n.language as Lang}
                style={{ width: 120 }}
                onChange={(l: Lang) => {
                  void i18n.changeLanguage(l)
                  persistLang(l)
                }}
                options={[
                  { value: 'zh-CN', label: '中文' },
                  { value: 'en', label: 'English' }
                ]}
              />
            </Layout.Header>
            <Layout.Content style={{ padding: 16, overflow: 'auto' }}>
              {activePage === 'sync' && <SyncPage />}
              {activePage === 'tools' && <TimeToolsPage />}
              {activePage === 'inspector' && <InspectorPage />}
              {activePage === 'history' && <HistoryPage />}
            </Layout.Content>
          </Layout>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}
