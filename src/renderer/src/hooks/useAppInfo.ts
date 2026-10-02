import { useEffect, useRef, useState } from 'react'
import type { AppInfo } from '@shared/index'
import { ck } from '@renderer/services/ck'

let cached: AppInfo | null = null
let pending: Promise<AppInfo> | null = null

/** App metadata (version, dataRoot, ffmpeg availability), fetched once per session. */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(cached)
  useEffect(() => {
    if (cached) {
      setInfo(cached)
      return
    }
    pending ??= ck.appInfo()
    void pending
      .then((i) => {
        cached = i
        setInfo(i)
      })
      .catch(() => {})
  }, [])
  return info
}
