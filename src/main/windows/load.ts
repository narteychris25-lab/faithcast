import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

export const PRELOAD = join(__dirname, '../preload/index.js')

/** Load a renderer entry (index.html / output.html) in dev or production. */
export function loadEntry(win: BrowserWindow, entry: 'index' | 'output'): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) return win.loadURL(`${devUrl}/${entry}.html`)
  return win.loadFile(join(__dirname, `../renderer/${entry}.html`))
}

/** Lock down navigation: no in-app navigation away, external links open in the browser. */
export function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
  })
  win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
    // Media device enumeration is needed to choose an audio output device.
    cb(permission === 'media' || permission === 'speaker-selection' || permission === 'fullscreen')
  })
}
