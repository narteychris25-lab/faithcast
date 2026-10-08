import { BrowserWindow, powerSaveBlocker, screen, type Display } from 'electron'
import type { AppSettings, LiveState, OutputStatus } from '@shared/types'
import { BRAND } from '@shared/brand'
import { findDisplay, listDisplays } from './displays'
import { hardenWindow, loadEntry, PRELOAD } from './load'
import { log } from '../log'

type Mode = 'fullscreen' | 'preview'

/**
 * Owns the audience-facing output window.
 *
 * - With a second display selected, the window covers that display
 *   completely (borderless, above the menu bar / taskbar) or uses native
 *   OS fullscreen, depending on settings.
 * - With no second display, it opens as a resizable 16:9 preview window
 *   on the operator's screen.
 *
 * The window never takes keyboard focus from the operator; key presses it
 * does receive are forwarded to the operator window.
 */
export class OutputManager {
  private win: BrowserWindow | null = null
  private mode: Mode | null = null
  private displayId: number | null = null
  /** Display the user asked for; used to restore output when it is reconnected. */
  private requestedDisplayId: number | null = null
  private state: LiveState | null = null
  private blocker: number | null = null

  constructor(
    private readonly operator: () => BrowserWindow | null,
    private readonly settings: () => AppSettings,
    private readonly emitStatus: (s: OutputStatus) => void,
    private readonly notice: (level: 'info' | 'warning', message: string) => void
  ) {}

  get window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null
  }

  status(): OutputStatus {
    const win = this.window
    if (!win) {
      return { open: false, displayId: null, displayLabel: '', fullscreen: false, width: 0, height: 0, previewMode: false }
    }
    const display = this.mode === 'fullscreen' ? findDisplay(this.displayId) : screen.getDisplayMatching(win.getBounds())
    const info = display ? listDisplays().find((d) => d.id === display.id) : undefined
    const [cw, ch] = win.getContentSize()
    const scale = display?.scaleFactor ?? 1
    return {
      open: true,
      displayId: this.mode === 'fullscreen' ? this.displayId : null,
      displayLabel: this.mode === 'fullscreen' ? (info?.label ?? 'External display') : 'Preview window',
      fullscreen: this.mode === 'fullscreen',
      width: Math.round(cw * scale),
      height: Math.round(ch * scale),
      previewMode: this.mode === 'preview'
    }
  }

  private operatorDisplay(): Display {
    const op = this.operator()
    return op && !op.isDestroyed() ? screen.getDisplayMatching(op.getBounds()) : screen.getPrimaryDisplay()
  }

  /** Open (or move) the output. displayId=null → preview window. */
  open(displayId: number | null): OutputStatus {
    this.requestedDisplayId = displayId
    const target = findDisplay(displayId)
    const useFullscreen = !!target && target.id !== this.operatorDisplay().id
    const mode: Mode = useFullscreen ? 'fullscreen' : 'preview'
    if (displayId !== null && !useFullscreen) {
      this.notice(
        'warning',
        target
          ? 'That display is showing the operator window, so the output opened as a preview window instead.'
          : 'The selected display is not connected. Output opened as a preview window.'
      )
    }

    // Frame style can't change on an existing window, so recreate on mode change.
    if (this.window && this.mode !== mode) this.destroyWindow()
    this.mode = mode
    this.displayId = useFullscreen ? target!.id : null

    if (!this.window) this.create(mode, target)
    else if (mode === 'fullscreen' && target) this.placeFullscreen(target)

    this.startPowerBlock()
    const status = this.status()
    this.emitStatus(status)
    return status
  }

  close(): OutputStatus {
    this.requestedDisplayId = null
    this.destroyWindow()
    const status = this.status()
    this.emitStatus(status)
    return status
  }

  pushState(state: LiveState): void {
    this.state = state
    this.window?.webContents.send('live:state', state)
  }

  get lastState(): LiveState | null {
    return this.state
  }

  // ------------------------------------------------------ display events

  onDisplayRemoved(display: Display): void {
    if (this.window && this.mode === 'fullscreen' && this.displayId === display.id) {
      const wanted = this.requestedDisplayId
      log.warn('output display removed; falling back to preview window')
      this.open(null)
      this.requestedDisplayId = wanted // remember so reconnecting restores it
      this.notice('warning', 'The presentation display was disconnected. Output moved to a preview window.')
    }
  }

  onDisplayAdded(display: Display): void {
    if (this.window && this.mode === 'preview' && this.requestedDisplayId === display.id) {
      this.open(display.id)
      this.notice('info', 'Presentation display reconnected. Output restored.')
    }
  }

  onDisplayMetricsChanged(display: Display): void {
    if (this.window && this.mode === 'fullscreen' && this.displayId === display.id) {
      this.placeFullscreen(display)
      this.emitStatus(this.status())
    }
  }

  // ------------------------------------------------------ internals

  private create(mode: Mode, target: Display | null): void {
    const native = this.settings().presentation.fullscreenMode === 'native'
    const common: Electron.BrowserWindowConstructorOptions = {
      show: false,
      backgroundColor: '#000000',
      title: `${BRAND.name} Output`,
      webPreferences: {
        preload: PRELOAD,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false,
        // Web slides (Internet section) render in an isolated <webview>; see main/web.ts.
        webviewTag: true
      }
    }

    let win: BrowserWindow
    if (mode === 'fullscreen' && target) {
      win = new BrowserWindow({
        ...common,
        ...target.bounds,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: native,
        hasShadow: false,
        roundedCorners: false,
        enableLargerThanScreen: true,
        skipTaskbar: true
      })
    } else {
      const wa = this.operatorDisplay().workArea
      const scale = Math.min(Math.max(this.settings().presentation.previewWindowScale, 0.2), 0.9)
      const width = Math.round(wa.width * scale)
      const height = Math.round((width * 9) / 16)
      win = new BrowserWindow({
        ...common,
        width,
        height,
        x: wa.x + wa.width - width - 24,
        y: wa.y + wa.height - height - 24,
        minWidth: 320,
        minHeight: 180,
        title: `${BRAND.name} — Audience Output (Preview)`,
        fullscreenable: true
      })
      win.setAspectRatio(16 / 9)
    }

    hardenWindow(win)
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.showInactive()
      if (mode === 'fullscreen' && target) this.placeFullscreen(target)
    })
    win.on('closed', () => {
      if (this.win === win) {
        this.win = null
        this.mode = null
        this.stopPowerBlock()
        this.emitStatus(this.status())
      }
    })
    win.on('resize', () => this.emitStatus(this.status()))
    // Keep the audience screen alive: reload the output if its renderer dies.
    win.webContents.on('render-process-gone', (_e, details) => {
      log.error('output renderer gone', details)
      setTimeout(() => !win.isDestroyed() && void loadEntry(win, 'output'), 300)
    })
    win.webContents.on('unresponsive', () => log.warn('output window unresponsive'))
    this.win = win
    void loadEntry(win, 'output')
  }

  private placeFullscreen(target: Display): void {
    const win = this.window
    if (!win) return
    const native = this.settings().presentation.fullscreenMode === 'native'
    if (native) {
      win.setBounds(target.bounds)
      if (!win.isFullScreen()) win.setFullScreen(true)
      return
    }
    // Borderless mode: cover the whole display, including the menu bar area.
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
    win.setBounds(target.bounds)
  }

  private destroyWindow(): void {
    const win = this.window
    this.win = null
    this.mode = null
    this.displayId = null
    this.stopPowerBlock()
    if (win) win.destroy()
  }

  private startPowerBlock(): void {
    // Prevent the projector going to sleep mid-service.
    if (this.blocker === null) this.blocker = powerSaveBlocker.start('prevent-display-sleep')
  }

  private stopPowerBlock(): void {
    if (this.blocker !== null) {
      powerSaveBlocker.stop(this.blocker)
      this.blocker = null
    }
  }
}
