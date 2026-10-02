import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Rectangle } from 'electron'
import { getDataRoot } from './paths'

interface WindowState extends Rectangle {
  maximized: boolean
}

const DEFAULTS = { width: 1440, height: 900, maximized: false }

function windowStatePath(): string {
  return join(getDataRoot(), 'window.json')
}

function load(): WindowState | null {
  try {
    const raw = JSON.parse(readFileSync(windowStatePath(), 'utf8'))
    if (
      Number.isFinite(raw.x) &&
      Number.isFinite(raw.y) &&
      Number.isFinite(raw.width) &&
      Number.isFinite(raw.height) &&
      raw.width >= 800 &&
      raw.height >= 560
    ) {
      return { x: raw.x, y: raw.y, width: raw.width, height: raw.height, maximized: !!raw.maximized }
    }
  } catch {
    /* first launch or unreadable */
  }
  return null
}

/** Bounds to open the window with, or null to use defaults. */
export function restoreWindowState(): WindowState | null {
  const st = load()
  if (!st) return null
  // keep the window reachable: reject obviously off-screen restores
  const onScreen = st.x! > -8000 && st.y! > -8000 && st.x! < 16000 && st.y! < 16000
  return onScreen ? st : null
}

export function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(windowStatePath(), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    /* best effort */
  }
}

export function windowStateExists(): boolean {
  return existsSync(windowStatePath())
}

export { DEFAULTS as DEFAULT_WINDOW_SIZE }
