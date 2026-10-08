import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, IPC_EVENTS, type WfBridge } from '../shared/ipc'

/**
 * The only bridge between web content and the main process. Channels and
 * events are allow-listed; the renderer never gets direct access to Node,
 * the filesystem or ipcRenderer.
 */
const channels = new Set<string>(IPC_CHANNELS)
const events = new Set<string>(IPC_EVENTS)

type Envelope = { ok: true; value: unknown } | { ok: false; error: string }

const bridge: WfBridge = {
  async invoke(channel, arg) {
    if (!channels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`)
    const res = (await ipcRenderer.invoke(channel, arg)) as Envelope
    if (!res.ok) throw new Error(res.error)
    return res.value as never
  },
  on(event, cb) {
    if (!events.has(event)) throw new Error(`Blocked IPC event: ${event}`)
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload as never)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  },
  pathForFile: (file) => webUtils.getPathForFile(file),
  platform: process.platform
}

contextBridge.exposeInMainWorld('wf', bridge)
