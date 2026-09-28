import type { CkApi } from './index'

declare global {
  interface Window {
    ckApi: CkApi
  }
}

export {}
