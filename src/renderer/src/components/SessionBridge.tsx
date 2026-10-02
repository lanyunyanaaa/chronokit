import { useEffect, useRef } from 'react'
import { App } from 'antd'
import { useTranslation } from 'react-i18next'
import { ck } from '@renderer/services/ck'
import type { SessionSnapshot } from '@shared/index'
import { useMediaStore } from '@renderer/store/mediaStore'
import { useNavStore, isPageKey } from '@renderer/store/navStore'
import { useMatchStore } from '@renderer/store/matchStore'
import { useTableStore } from '@renderer/store/tableStore'

const SAVE_DEBOUNCE_MS = 800

/**
 * Workspace memory: restores the last session (file lists, page, match
 * threshold) once on startup, then persists every change (debounced) to
 * session.json via the main process. Restoring is skipped in screenshot
 * automation mode (main returns null there).
 */
export default function SessionBridge(): null {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const restoredRef = useRef(false)
  const persistRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let snap: SessionSnapshot | null = null
      try {
        snap = await ck.sessionLoad()
      } catch {
        snap = null
      }
      if (cancelled) return
      if (snap) {
        const media = useMediaStore.getState()
        for (const kind of ['sources', 'targets', 'tools', 'checkup', 'table', 'rename'] as const) {
          const paths = snap.lists[kind]
          if (paths.length) await media.addPaths(kind, paths, { autoMatch: false })
        }
        useTableStore.getState().replaceAll(snap.tableEdits ?? {})
        const { sources, targets, tools, checkup, table, rename } = useMediaStore.getState().lists
        const n =
          sources.length + targets.length + tools.length + checkup.length + table.length + rename.length
        if (n > 0) {
          useMatchStore.getState().setThreshold(snap.threshold)
          useMatchStore.getState().runMatch()
          if (isPageKey(snap.activePage)) useNavStore.getState().setPage(snap.activePage)
          message.success(t('session.restoredN', { n }))
        } else {
          message.info(t('session.gone'))
        }
      }
      restoredRef.current = true
      // persist the restored state right away: the debounced save is purely
      // change-driven, and a session nobody touched would never be rewritten
      persistRef.current()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const persist = (): void => {
      const { lists } = useMediaStore.getState()
      const { activePage } = useNavStore.getState()
      const { threshold } = useMatchStore.getState()
      const { edits } = useTableStore.getState()
      void ck
        .sessionSave({
          version: 1,
          savedAt: Date.now(),
          lists: {
            sources: [...lists.sources],
            targets: [...lists.targets],
            tools: [...lists.tools],
            checkup: [...lists.checkup],
            table: [...lists.table],
            rename: [...lists.rename]
          },
          tableEdits: edits,
          activePage,
          threshold
        })
        .catch(() => {})
    }
    persistRef.current = persist
    const scheduleSave = (): void => {
      if (!restoredRef.current) return
      clearTimeout(timer)
      timer = setTimeout(persist, SAVE_DEBOUNCE_MS)
    }
    const unsubs = [
      useMediaStore.subscribe(scheduleSave),
      useNavStore.subscribe(scheduleSave),
      useMatchStore.subscribe(scheduleSave),
      useTableStore.subscribe(scheduleSave)
    ]
    return () => {
      unsubs.forEach((u) => u())
      clearTimeout(timer)
    }
  }, [])

  return null
}
