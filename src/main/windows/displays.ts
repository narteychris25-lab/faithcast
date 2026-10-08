import { screen, BrowserWindow, type Display } from 'electron'
import type { DisplayInfo } from '@shared/types'

export function toDisplayInfo(d: Display, index: number): DisplayInfo {
  const primary = d.id === screen.getPrimaryDisplay().id
  const w = Math.round(d.size.width * d.scaleFactor)
  const h = Math.round(d.size.height * d.scaleFactor)
  const name = d.label || (d.internal ? 'Built-in Display' : `External Display`)
  return {
    id: d.id,
    label: `Display ${index + 1} — ${name}`,
    width: w,
    height: h,
    scaleFactor: d.scaleFactor,
    refreshRate: d.displayFrequency || 60,
    primary,
    internal: !!d.internal,
    bounds: { ...d.bounds }
  }
}

/** Displays ordered primary-first so "Display 1" is always the operator's main screen. */
export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  const all = [...screen.getAllDisplays()].sort((a, b) =>
    a.id === primaryId ? -1 : b.id === primaryId ? 1 : a.bounds.x - b.bounds.x
  )
  return all.map(toDisplayInfo)
}

export function findDisplay(id: number | null): Display | null {
  if (id === null) return null
  return screen.getAllDisplays().find((d) => d.id === id) ?? null
}

/**
 * Briefly shows a large label on every connected display so the operator
 * can tell which physical screen is which.
 */
export function identifyDisplays(): void {
  for (const info of listDisplays()) {
    const w = 640
    const h = 240
    const win = new BrowserWindow({
      x: Math.round(info.bounds.x + (info.bounds.width - w) / 2),
      y: Math.round(info.bounds.y + (info.bounds.height - h) / 2),
      width: w,
      height: h,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    const [num, ...rest] = info.label.split(' — ')
    const html = `<html><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(15,23,42,.92);color:#fff;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;border-radius:24px;border:4px solid #0b6cf5">
      <div style="font-size:96px;font-weight:800">${escapeHtml(num)}</div>
      <div style="font-size:26px;opacity:.8">${escapeHtml(rest.join(' — '))} · ${info.width}×${info.height}</div></body></html>`
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => win.showInactive())
    setTimeout(() => !win.isDestroyed() && win.destroy(), 2500)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
