import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

/**
 * Single source of truth for every color, spacing, radius, shadow and font in
 * the app. `lightTheme` (antd ThemeConfig) and `injectCkTokens()` (--ck-* CSS
 * variables) both derive from the objects below, so TSX and styles.css can
 * never drift apart. Hex literals outside this file are a lint-level violation.
 *
 * Light "daylight" theme: a cool grey canvas with white cards floating on
 * soft shadows. Depth order reads card (white) → raised controls → hover —
 * the reverse of a dark UI: elevation brightens toward white.
 */
export const palette = {
  /* --- surfaces: grey canvas → white cards → grey controls ---------- */
  bg: '#f2f4f8',
  surface: '#f7f9fc',
  card: '#ffffff',
  raised: '#f1f4f9',
  hover: '#e8ecf3',
  high: '#ffffff',

  /* --- lines ------------------------------------------------------- */
  border: '#d8dee8',
  borderSoft: '#e7ebf1',
  divider: 'rgba(15, 23, 42, 0.055)',

  /* --- text -------------------------------------------------------- */
  text: '#1a2230',
  text2: '#4b5568',
  text3: '#76819a',
  text4: '#9aa4b8',

  /* --- brand ------------------------------------------------------- */
  accent: '#2563eb',
  accent2: '#7c3aed',
  accentSoft: 'rgba(37, 99, 235, 0.1)',
  accentLine: 'rgba(37, 99, 235, 0.34)',
  accentText: '#1d4ed8',
  accentTextStrong: '#1e40af',
  onAccent: '#ffffff',

  /* --- semantic ---------------------------------------------------- */
  green: '#16a34a',
  greenText: '#15803d',
  amber: '#f59e0b',
  amberText: '#b45309',
  red: '#dc2626',
  redText: '#b91c1c',
  purple: '#7c3aed',
  purpleText: '#6d28d9',

  /* --- misc -------------------------------------------------------- */
  tooltipBg: '#1e2836',
  tooltipText: '#eef2f8',
  scrollbar: '#c6cdd9',
  scrollbarHover: '#a9b3c2',
  thumbBg: '#e9edf3',
  winClose: '#e81123',

  /* --- shape / type ------------------------------------------------ */
  fontFamily:
    "'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, sans-serif",
  fontMono: "'Cascadia Mono', 'JetBrains Mono', Consolas, ui-monospace, monospace"
} as const

/** 4px-based spacing scale; referenced as space[3] → 12px. */
export const space = { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24 } as const

/** Corner radii. `lg` for panels, `md` for rows/inputs, `sm` for chips. */
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const

/** Font sizes in px; `hd` is the page title. */
export const fontSize = {
  xs: 10.5,
  sm: 11.5,
  md: 12.5,
  base: 13.5,
  lg: 15,
  hd: 19
} as const

/** Elevation. Light UIs read depth from soft, slightly cool shadows. */
export const shadow = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 8px 24px rgba(15, 23, 42, 0.1)',
  lg: '0 20px 48px rgba(15, 23, 42, 0.16)',
  accent: '0 2px 12px rgba(37, 99, 235, 0.28)'
} as const

/** Fixed shell metrics shared by CSS and TSX (virtualizer row pitch). */
export const layout = {
  titlebarH: 42,
  sidenavW: 212,
  /** Media row pitch = 56px card + 8px gap (mirrored in styles.css). */
  rowH: 64,
  toolH: 32
} as const

/** "r,g,b" triple so CSS can write rgba(var(--ck-*-rgb), 0.35). */
const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/** rgba() string from a palette hex — for antd tokens that want translucency. */
const alpha = (hex: string, a: number): string => `rgba(${rgb(hex)}, ${a})`

export const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: palette.accent,
    colorInfo: palette.accent,
    colorSuccess: palette.green,
    colorWarning: palette.amber,
    colorError: palette.red,
    colorBgBase: palette.card,
    colorBgLayout: palette.bg,
    colorBgContainer: palette.card,
    colorBgElevated: palette.high,
    colorBgSpotlight: palette.tooltipBg,
    colorBorder: palette.border,
    colorBorderSecondary: palette.borderSoft,
    colorText: palette.text,
    colorTextSecondary: palette.text2,
    colorTextTertiary: palette.text3,
    colorTextQuaternary: palette.text4,
    controlHeight: layout.toolH,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    borderRadiusSM: radius.sm,
    fontFamily: palette.fontFamily,
    fontSize: fontSize.base,
    boxShadow: shadow.md,
    boxShadowSecondary: shadow.lg,
    wireframe: false
  },
  components: {
    Button: {
      fontWeight: 500,
      defaultBg: palette.raised,
      defaultBorderColor: palette.border,
      defaultColor: palette.text,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      paddingInline: 13
    },
    Table: {
      headerBg: 'transparent',
      headerColor: palette.text3,
      rowHoverBg: alpha(palette.accent, 0.05),
      borderColor: palette.borderSoft,
      headerSplitColor: 'transparent',
      cellPaddingBlockSM: 6,
      cellPaddingInlineSM: 10,
      cellFontSizeSM: fontSize.md,
      footerBg: 'transparent'
    },
    Input: {
      activeBorderColor: palette.accent,
      hoverBorderColor: palette.accentLine,
      colorBgContainer: palette.card
    },
    InputNumber: {
      activeBorderColor: palette.accent,
      hoverBorderColor: palette.accentLine,
      colorBgContainer: palette.card
    },
    Select: {
      colorBgContainer: palette.card,
      optionSelectedBg: palette.accentSoft,
      optionSelectedColor: palette.accentTextStrong,
      optionActiveBg: alpha(palette.accent, 0.07),
      selectorBg: palette.card
    },
    DatePicker: {
      colorBgContainer: palette.card,
      activeBorderColor: palette.accent,
      hoverBorderColor: palette.accentLine
    },
    Segmented: {
      trackBg: palette.hover,
      itemColor: palette.text2,
      itemHoverBg: palette.raised,
      itemHoverColor: palette.text,
      itemSelectedBg: palette.card,
      itemSelectedColor: palette.accentTextStrong
    },
    Modal: {
      contentBg: palette.card,
      headerBg: 'transparent',
      titleColor: palette.text,
      titleFontSize: fontSize.lg,
      footerBg: 'transparent'
    },
    Dropdown: {
      colorBgElevated: palette.high,
      controlItemBgHover: alpha(palette.accent, 0.07)
    },
    Tooltip: {
      colorBgSpotlight: palette.tooltipBg,
      colorTextLightSolid: palette.tooltipText
    },
    Popconfirm: {
      colorBgElevated: palette.high
    },
    Menu: {
      itemColor: palette.text2,
      itemHoverColor: palette.text,
      itemHoverBg: palette.hover,
      itemSelectedBg: palette.accentSoft,
      itemSelectedColor: palette.accentTextStrong,
      groupTitleColor: palette.text4,
      popupBg: palette.high
    },
    Card: { colorBgContainer: palette.card },
    Collapse: {
      headerBg: palette.raised,
      contentBg: palette.surface,
      colorBorder: palette.borderSoft,
      contentPadding: '6px 12px'
    },
    Progress: { defaultColor: palette.accent, remainingColor: palette.hover },
    Pagination: { itemBg: 'transparent', itemActiveBg: palette.accentSoft },
    Empty: { colorTextDescription: palette.text3 },
    Descriptions: {
      labelBg: palette.raised,
      titleColor: palette.text2,
      itemPaddingBottom: 8
    },
    Tag: { defaultBg: palette.raised, defaultColor: palette.text2 },
    Spin: { colorPrimary: palette.accent }
  }
}

/** Mirror every token into --ck-* custom properties on :root. Runs before render. */
export function injectCkTokens(): void {
  const vars: Record<string, string> = {
    /* surfaces */
    '--ck-bg': palette.bg,
    '--ck-surface': palette.surface,
    '--ck-card': palette.card,
    '--ck-raised': palette.raised,
    '--ck-hover': palette.hover,
    '--ck-high': palette.high,
    /* lines */
    '--ck-border': palette.border,
    '--ck-border-soft': palette.borderSoft,
    '--ck-divider': palette.divider,
    /* text */
    '--ck-text': palette.text,
    '--ck-text-2': palette.text2,
    '--ck-text-3': palette.text3,
    '--ck-text-4': palette.text4,
    /* brand */
    '--ck-accent': palette.accent,
    '--ck-accent-2': palette.accent2,
    '--ck-accent-soft': palette.accentSoft,
    '--ck-accent-line': palette.accentLine,
    '--ck-accent-text': palette.accentText,
    '--ck-accent-text-strong': palette.accentTextStrong,
    '--ck-on-accent': palette.onAccent,
    /* semantic */
    '--ck-green': palette.green,
    '--ck-green-text': palette.greenText,
    '--ck-amber': palette.amber,
    '--ck-amber-text': palette.amberText,
    '--ck-red': palette.red,
    '--ck-red-text': palette.redText,
    '--ck-purple': palette.purple,
    '--ck-purple-text': palette.purpleText,
    /* rgb triples for translucent fills */
    '--ck-bg-rgb': rgb(palette.bg),
    '--ck-surface-rgb': rgb(palette.surface),
    '--ck-card-rgb': rgb(palette.card),
    '--ck-accent-rgb': rgb(palette.accent),
    '--ck-accent-2-rgb': rgb(palette.accent2),
    '--ck-green-rgb': rgb(palette.green),
    '--ck-amber-rgb': rgb(palette.amber),
    '--ck-red-rgb': rgb(palette.red),
    '--ck-purple-rgb': rgb(palette.purple),
    '--ck-text-rgb': rgb(palette.text),
    /* misc */
    '--ck-scrollbar': palette.scrollbar,
    '--ck-scrollbar-hover': palette.scrollbarHover,
    '--ck-thumb-bg': palette.thumbBg,
    '--ck-thumb-ph': palette.raised,
    '--ck-win-close': palette.winClose,
    '--ck-font': palette.fontFamily,
    '--ck-font-mono': palette.fontMono,
    /* spacing */
    ...Object.fromEntries(Object.entries(space).map(([k, v]) => [`--ck-sp-${k}`, `${v}px`])),
    /* radii */
    '--ck-r-sm': `${radius.sm}px`,
    '--ck-r-md': `${radius.md}px`,
    '--ck-r-lg': `${radius.lg}px`,
    '--ck-r-xl': `${radius.xl}px`,
    '--ck-r-pill': `${radius.pill}px`,
    /* type scale */
    ...Object.fromEntries(Object.entries(fontSize).map(([k, v]) => [`--ck-fs-${k}`, `${v}px`])),
    '--ck-lh-tight': '1.25',
    '--ck-lh-base': '1.5',
    /* elevation */
    '--ck-sh-sm': shadow.sm,
    '--ck-sh-md': shadow.md,
    '--ck-sh-lg': shadow.lg,
    '--ck-sh-accent': shadow.accent,
    /* motion */
    '--ck-t-fast': '120ms',
    '--ck-t-base': '180ms',
    '--ck-ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
    /* shell metrics */
    '--ck-titlebar-h': `${layout.titlebarH}px`,
    '--ck-sidenav-w': `${layout.sidenavW}px`,
    '--ck-row-h': `${layout.rowH}px`,
    '--ck-tool-h': `${layout.toolH}px`
  }
  const el = document.createElement('style')
  el.textContent = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`
  document.head.appendChild(el)
}
