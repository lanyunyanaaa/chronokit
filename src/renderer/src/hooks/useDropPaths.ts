import { useMemo, useRef, useState } from 'react'

/**
 * Wire a drop zone that yields absolute paths of OS-dragged files.
 * Returns `dragOver` for styling and spreadable `dragProps`; `onPaths` may
 * change every render, only its latest version is invoked.
 */
export function useDropPaths(onPaths: (paths: string[]) => void): {
  dragOver: boolean
  dragProps: React.HTMLAttributes<HTMLElement>
} {
  const [dragOver, setDragOver] = useState(false)
  const cbRef = useRef(onPaths)
  cbRef.current = onPaths

  const dragProps = useMemo<React.HTMLAttributes<HTMLElement>>(
    () => ({
      onDragOver: (e) => {
        e.preventDefault()
        setDragOver(true)
      },
      onDragLeave: () => setDragOver(false),
      onDrop: (e) => {
        e.preventDefault()
        setDragOver(false)
        const paths = Array.from(e.dataTransfer.files)
          .map((f) => window.ckApi.getPathForFile(f))
          .filter(Boolean)
        if (paths.length) cbRef.current(paths)
      }
    }),
    []
  )

  return { dragOver, dragProps }
}
