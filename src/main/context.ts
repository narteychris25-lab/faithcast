import type { BrowserWindow } from 'electron'
import type { IpcEvent, IpcEvents } from '@shared/ipc'
import type { AppSettings, LiveState, RecoveryInfo } from '@shared/types'
import type { Repos } from './db/repos'
import type { OutputManager } from './windows/output'

/** Services the IPC layer needs from the application shell. */
export interface AppContext {
  repos: Repos
  output: OutputManager
  operator: () => BrowserWindow | null
  broadcast: <E extends IpcEvent>(event: E, payload: IpcEvents[E]) => void
  sendToOperator: <E extends IpcEvent>(event: E, payload: IpcEvents[E]) => void
  onLiveUpdate: (state: LiveState) => void
  onSettingsChanged: (s: AppSettings) => void
  recovery: () => RecoveryInfo
  clearRecovery: () => void
  setUnsaved: (v: boolean) => void
  restoreDatabase: (file: string) => void
  loadDemo: () => Promise<{ serviceId: string | null }>
  removeDemo: () => { removed: number }
}
