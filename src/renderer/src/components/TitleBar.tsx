import { useEffect, useState } from 'react'
import { ck } from '@renderer/services/ck'

export default function TitleBar() {
  const [maxed, setMaxed] = useState(false)

  useEffect(() => ck.onWindowState(setMaxed), [])

  return (
    <div className="ck-titlebar">
      <div className="ck-brand">
        <div className="ck-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.2" />
            <path d="M12 7.5v5l3.5 2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="ck-brand-name">ChronoKit</span>
        <span className="ck-version">v0.1</span>
      </div>
      <div className="ck-win-controls">
        <button className="ck-win-btn" aria-label="minimize" onClick={ck.minimizeWindow}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="ck-win-btn" aria-label="maximize" onClick={ck.toggleMaximize}>
          {maxed ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" />
              <path d="M2.5 2V0.5H9.5V7.5H8" stroke="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" />
            </svg>
          )}
        </button>
        <button className="ck-win-btn ck-win-close" aria-label="close" onClick={ck.closeWindow}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
