import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Rendered inline after the title: counts, status chips. */
  badge?: ReactNode
  desc?: string
  actions?: ReactNode
}

export default function PageHeader({ title, badge, desc, actions }: Props) {
  return (
    <div className="ck-pagehead">
      <div className="ck-grow">
        <h1 className="ck-pagehead-title">
          {title}
          {badge}
        </h1>
        {desc && <div className="ck-pagehead-desc">{desc}</div>}
      </div>
      {actions && <div className="ck-pagehead-actions">{actions}</div>}
    </div>
  )
}
