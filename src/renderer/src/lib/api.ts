import type { IpcArg, IpcChannel, IpcEvent, IpcEvents, IpcResult } from '@shared/ipc'
import { BRAND } from '@shared/brand'

/** Typed call into the main process. Rejects with a readable Error on failure. */
export function api<C extends IpcChannel>(channel: C, ...arg: IpcArg<C> extends void ? [] : [IpcArg<C>]): Promise<IpcResult<C>> {
  return window.wf.invoke(channel, arg[0] as IpcArg<C>)
}

export function onEvent<E extends IpcEvent>(event: E, cb: (payload: IpcEvents[E]) => void): () => void {
  return window.wf.on(event, cb)
}

export const mediaUrl = (id: string) => `${BRAND.mediaScheme}://media/${encodeURIComponent(id)}`
export const thumbUrl = (id: string, bust?: string) =>
  `${BRAND.mediaScheme}://thumb/${encodeURIComponent(id)}${bust ? `?v=${encodeURIComponent(bust)}` : ''}`
