/**
 * Hand-drawn stroke icon set (no emoji, no icon font): one visual weight
 * (1.7px stroke on a 24px grid, currentColor) shared by the nav rail, empty
 * states and inline row affordances.
 */
interface IconProps {
  size?: number
}

function base(size = 20): React.CSSProperties {
  return { width: size, height: size, flexShrink: 0, display: 'block' }
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
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

/** Health-check pulse (clipboard with heartbeat line). */
export function HealthIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M9 3.5V2.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.9" />
      <path d="M7.5 12h2.4l1.5-3 2.2 6 1.5-3h2.4" />
    </svg>
  )
}

/** Data grid (batch editing table). */
export function TableIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9.5 9.5v10" />
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

/** Folder with a down arrow — smart folder import. */
export function FolderImportIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M3.5 6.8a2 2 0 0 1 2-2h4.1l2 2.4h7.4a2 2 0 0 1 2 2v1.9" />
      <path d="M3.5 6.8v11.4a2 2 0 0 0 2 2h6.2" />
      <path d="M16.6 11.2v6.4M14.1 15l2.5 2.6 2.5-2.6" />
    </svg>
  )
}

/** Clock with a counter-clockwise arrow — recently used folders. */
export function RecentIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M3.6 12a8.4 8.4 0 1 0 8.4-8.4c-2.5 0-4.8 1-6.4 2.7L3.6 8.3" />
      <path d="M3.6 3.6v4.7h4.7" />
      <path d="M12 7.6V12l3.4 2" />
    </svg>
  )
}

/** Two arrows swapping places — time sync between source and target. */
export function SyncIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 8.5h13.5M14 5l3.5 3.5L14 12" />
      <path d="M20 15.5H6.5M10 12 6.5 15.5 10 19" />
    </svg>
  )
}

/** Clock face over slider tracks — batch time editor. */
export function ToolsIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3.1 1.9" />
    </svg>
  )
}

/** Frame with a magnifier inside — metadata inspector. */
export function InspectorIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M3 8.5V6a2 2 0 0 1 2-2h4.5M15.5 4H19a2 2 0 0 1 2 2v2.5" />
      <path d="M3 15.5V18a2 2 0 0 0 2 2h4.5M15.5 20H19a2 2 0 0 0 2-2v-2.5" />
      <circle cx="11.4" cy="11.4" r="3.6" />
      <path d="m14.2 14.2 2.4 2.4" />
    </svg>
  )
}

/** Stacked rows with a clock — operation history / undo. */
export function HistoryIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 6.4V11l3 1.8" />
      <path d="M3.9 9.4A8.6 8.6 0 1 1 3.4 12" />
      <path d="M3.2 5.6v4.2h4.2" />
      <path d="M16.5 6.2 20 3.6" opacity="0.55" />
    </svg>
  )
}

/** Right arrow — "time flows from source to target". */
export function ArrowRightIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 12h15M14 6.5 19.5 12 14 17.5" />
    </svg>
  )
}

/** Close / remove. */
export function CloseIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  )
}

/** Check mark (toggle marks, done states). */
export function CheckIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke} strokeWidth={2.6}>
      <path d="m5 12.6 4.4 4.4L19 7.2" />
    </svg>
  )
}

/** Tag / label — metadata-sourced time. */
export function TagIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M11.6 3.5H5.8A2.3 2.3 0 0 0 3.5 5.8v5.8c0 .6.2 1.2.7 1.6l6.6 6.6a2.3 2.3 0 0 0 3.3 0l5.8-5.8a2.3 2.3 0 0 0 0-3.3L13.2 4.2a2.3 2.3 0 0 0-1.6-.7z" />
      <circle cx="8.4" cy="8.4" r="1.3" />
    </svg>
  )
}

/** Text lines — time parsed from the filename. */
export function TextLinesIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 6.5h16M4 12h11M4 17.5h7" />
    </svg>
  )
}

/** Clock face — generic "time" glyph. */
export function ClockIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3.1 1.9" />
    </svg>
  )
}

/** Stack of rows — multi-select / select all. */
export function SelectAllIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.2 12.2 2.6 2.6 5-5.4" />
    </svg>
  )
}

/** Alert triangle — probe failures, warnings. */
export function AlertIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 4.4 2.9 19.4h18.2L12 4.4z" />
      <path d="M12 10v4M12 16.8v.2" />
    </svg>
  )
}

/** Trash — destructive row action. */
export function TrashIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.6 7l.9 11.2A1.8 1.8 0 0 0 9.3 20h5.4a1.8 1.8 0 0 0 1.8-1.8L17.4 7" />
      <path d="M10.4 11v5.2M13.6 11v5.2" />
    </svg>
  )
}

/** Wrench-free settings glyph: sliders — mode / options. */
export function SlidersIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M5 7.5h14M5 16.5h14" />
      <circle cx="9.5" cy="7.5" r="2" />
      <circle cx="14.5" cy="16.5" r="2" />
    </svg>
  )
}

/** Database / safety glyph — backup & journal safety net. */
export function ShieldIcon({ size }: IconProps) {
  return (
    <svg style={base(size)} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3.4 5 6v6c0 4 2.9 7.2 7 8.6 4.1-1.4 7-4.6 7-8.6V6l-7-2.6z" />
      <path d="m9.2 12 2 2.1 3.6-3.9" />
    </svg>
  )
}
