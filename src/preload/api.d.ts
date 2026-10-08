import type { WfBridge } from '../shared/ipc'

declare global {
  interface Window {
    wf: WfBridge
  }
}

export {}
