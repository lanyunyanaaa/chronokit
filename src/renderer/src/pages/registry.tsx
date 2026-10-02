import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import type { PageKey } from '@renderer/store/navStore'

/**
 * Page route table. Pages are lazy chunks, so startup only loads the active
 * page; adding a U1 page means one entry here plus one in navStore's PageKey.
 */
export const pageRegistry: Record<PageKey, LazyExoticComponent<ComponentType>> = {
  sync: lazy(() => import('./SyncPage')),
  tools: lazy(() => import('./TimeToolsPage')),
  inspector: lazy(() => import('./InspectorPage')),
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
