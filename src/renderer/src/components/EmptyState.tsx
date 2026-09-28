import type { ReactNode } from 'react'
import { InboxIcon } from './icons'

interface Props {
  icon?: ReactNode
  title: string
  hint?: string
}

export default function EmptyState({ icon = <InboxIcon />, title, hint }: Props) {
  return (
    <div className="ck-empty">
      <div className="ck-empty-icon">{icon}</div>
      <div className="ck-empty-title">{title}</div>
      {hint && <div className="ck-empty-hint">{hint}</div>}
    </div>
  )
}
