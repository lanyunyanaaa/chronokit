interface IconProps {
  size?: number
}

function base(size = 22): React.CSSProperties & { width: number; height: number } {
  return { width: size, height: size, flexShrink: 0 }
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

/** Film / video clip icon. */
export function FilmIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M7.5 4v16M16.5 4v16M2.5 9.2h5M2.5 14.8h5M16.5 9.2h5M16.5 14.8h5" />
    </svg>
  )
}

/** Magnifier icon. */
export function SearchIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.3 20.3-4-4" />
    </svg>
  )
}

/** Inbox icon (generic empty state). */
export function InboxIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" />
    </svg>
  )
}
