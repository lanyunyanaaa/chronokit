import { theme } from 'antd'

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#5b8cff',
    colorInfo: '#5b8cff',
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorBgBase: '#0d0f13',
    colorBgContainer: '#171b23',
    colorBgElevated: '#212734',
    colorBorder: '#2a3040',
    colorBorderSecondary: '#222835',
    colorText: '#e7eaf1',
    colorTextSecondary: '#9aa3b4',
    colorTextTertiary: '#5f6879',
    borderRadius: 9,
    fontFamily:
      "'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, sans-serif"
  },
  components: {
    Table: {
      headerBg: 'rgba(255,255,255,0.025)',
      rowHoverBg: '#1d222d'
    },
    Modal: {
      contentBg: '#171b23',
      headerBg: '#171b23'
    },
    Tooltip: {
      colorBgSpotlight: '#262d3c'
    },
    Card: {
      colorBgContainer: '#171b23'
    }
  }
}
