import { app, BrowserWindow } from 'electron'
import { log } from '../log'
import { BRAND } from '@shared/brand'
import { loadEntry } from './load'

/** Shortest time the splash stays up, so a fast start doesn't flash it. */
const MIN_VISIBLE_MS = 1200

export interface Splash {
  /** Update the status line ("Opening your library…"); resolves once the splash has painted it. */
  status(text: string): Promise<void>
  /** Hand over to the main window: waits out MIN_VISIBLE_MS, calls showNext, then removes the splash behind it. */
  close(showNext?: () => void): Promise<void>
  /** Remove the splash straight away (startup failed). */
  destroy(): void
}

/**
 * The launch splash: a small frameless window shown before the database opens, so
 * there's something on screen while the library, Bibles and daily backup load.
 * Its animations run in its own renderer process, so they keep moving while the
 * main process is busy.
 */
export async function showSplash(): Promise<Splash> {
  const win = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    show: false,
    center: true,
    title: BRAND.name,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  let shownAt = Date.now()
  const ready = new Promise<void>((resolve) => {
    win.once('ready-to-show', () => {
      win.show()
      shownAt = Date.now()
      resolve()
    })
    // never hold up startup if the splash itself fails to load
    setTimeout(resolve, 2500)
  })
  loadEntry(win, 'splash', { v: app.getVersion() }).catch((e) => log.warn('splash failed to load', e))
  await ready

  const alive = () => !win.isDestroyed()
  return {
    async status(text) {
      if (!alive()) return
      try {
        await win.webContents.executeJavaScript(`window.fcSplash && window.fcSplash(${JSON.stringify(text)})`)
        // give the splash a frame to paint before the main process does blocking work
        await new Promise((r) => setTimeout(r, 30))
      } catch {
        /* splash not loaded yet */
      }
    },
    async close(showNext) {
      const wait = MIN_VISIBLE_MS - (Date.now() - shownAt)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      showNext?.()
      // the main window now covers the splash; remove it once that window has painted
      await new Promise((r) => setTimeout(r, 150))
      if (alive()) win.destroy()
    },
    destroy() {
      if (alive()) win.destroy()
    }
  }
}
