import type { FcBridge } from '../shared/ipc'

declare global {
  interface Window {
    fc: FcBridge
  }
}

export {}
