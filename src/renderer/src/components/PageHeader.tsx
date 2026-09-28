import type { ReactNode } from 'react'

interface Props {
  title: string
  desc?: string
  actions?: ReactNode
}

export default function PageHeader({ title, desc, actions }: Props) {
  return (
    <div className="ck-pagehead">
      <div>
        <h1 className="ck-pagehead-title">{title}</h1>
        {desc && <div className="ck-pagehead-desc">{desc}</div>}
      </div>
      {actions && <div className="ck-pagehead-actions">{actions}</div>}
    </div>
  )
}
