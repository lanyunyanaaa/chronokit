import type { HTMLAttributes, ReactNode } from 'react'
import PageHeader from './PageHeader'

interface Props {
  title: string
  badge?: ReactNode
  desc?: string
  actions?: ReactNode
  /** Sticky bottom action bar (write targets, preview/execute…) — stays visible
      while the page scrolls, so the primary action is never off-screen. */
  footer?: ReactNode
  /** Extra props for the page root (drop-zone handlers, state classes). */
  pageProps?: HTMLAttributes<HTMLElement>
  children: ReactNode
}

/** Page scaffold: header / content stack / optional sticky action bar. */
export default function PageShell({
  title,
  badge,
  desc,
  actions,
  footer,
  pageProps,
  children
}: Props) {
  const { className: extraClass, ...rest } = pageProps ?? {}
  return (
    <div className={`ck-page ${extraClass ?? ''}`} {...rest}>
      <PageHeader title={title} badge={badge} desc={desc} actions={actions} />
      {children}
      {footer && <div className="ck-actionbar">{footer}</div>}
    </div>
  )
}
