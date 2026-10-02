import type { ReactNode } from 'react'
import { InboxIcon } from './icons'

interface Props {
  icon?: ReactNode
  title: string
  hint?: string
  /** Primary next-step controls — an empty panel should tell the user what to
      do instead of only describing the emptiness. */
  actions?: ReactNode
  dropActive?: boolean
}

export default function EmptyState({ icon = <InboxIcon size={22} />, title, hint, actions, dropActive }: Props) {
  return (
    <div className={`ck-empty ${dropActive ? 'is-drop' : ''}`}>
      <div className="ck-empty-icon">{icon}</div>
      <div className="ck-empty-title">{title}</div>
      {hint && <div className="ck-empty-hint">{hint}</div>}
      {actions && <div className="ck-empty-actions">{actions}</div>}
    </div>
  )
}
