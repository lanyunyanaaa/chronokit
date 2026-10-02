import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import type { PageKey } from '@renderer/store/navStore'

/**
 * Page route table. Pages are lazy chunks, so startup only loads the active
 * page; adding a U1 page means one entry here plus one in navStore's PageKey.
 */
export const pageRegistry: Record<PageKey, LazyExoticComponent<ComponentType>> = {
  checkup: lazy(() => import('./CheckupPage')),
  sync: lazy(() => import('./SyncPage')),
  tools: lazy(() => import('./TimeToolsPage')),
  table: lazy(() => import('./BatchTablePage')),
  rename: lazy(() => import('./RenamePage')),
  inspector: lazy(() => import('./InspectorPage')),
  backups: lazy(() => import('./BackupCenterPage')),
  history: lazy(() => import('./HistoryPage'))
}

export function PageOutlet({ page }: { page: PageKey }): React.JSX.Element {
  const Active = pageRegistry[page]
  return (
    <Suspense fallback={null}>
      <Active />
    </Suspense>
  )
}
