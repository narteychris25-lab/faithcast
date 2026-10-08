import { app, BrowserWindow, dialog, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import type { IpcEvent, IpcEvents } from '@shared/ipc'
import type { AppSettings, LiveState, RecoveryInfo } from '@shared/types'
import { BRAND } from '@shared/brand'
import { openDatabase, type DB } from './db/connection'
import { createRepos, type Repos } from './db/repos'
import { relinkDemoMedia, removeDemo, seedBibles, seedDemo } from './db/seed'
import { migrateLegacyData } from './legacy'
import { paths } from './paths'
import { log } from './log'
import { createBackupSync, pruneBackups, replaceDatabaseFile } from './backup'
import { handleMediaProtocol, registerMediaScheme } from './media/protocol'
import { makeThumbnail } from './media/importer'
import { OutputManager } from './windows/output'
import { listDisplays } from './windows/displays'
import { hardenWindow, loadEntry, PRELOAD } from './windows/load'
import { registerIpc } from './ipc/handlers'
import { setupWebSandbox } from './web'
import { buildMenu } from './menu'
import type { AppContext } from './context'

// ------------------------------------------------------------------ process safety

process.on('uncaughtException', (e) => log.error('uncaughtException', e))
process.on('unhandledRejection', (e) => log.error('unhandledRejection', e))

if (process.env.FAITHCAST_DATA_DIR) app.setPath('userData', process.env.FAITHCAST_DATA_DIR)
// `npm run dev` gets its own data folder, so it runs alongside the installed app and never touches the church's real data
else if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), `${BRAND.name} Dev`))
app.setName(BRAND.name)
// First launch after the rename: bring over the old data folder (tests use their own folder)
if (!process.env.FAITHCAST_DATA_DIR) migrateLegacyData(app.getPath('userData'))
// Windows groups taskbar buttons and notifications by this ID; it must match appId in electron-builder.yml.
if (process.platform === 'win32') app.setAppUserModelId(BRAND.appId)
registerMediaScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let db: DB
let repos: Repos
let operatorWin: BrowserWindow | null = null
let output: OutputManager
let unsaved = false
let quitting = false
let crashedLastRun = false
let lastLiveSave = 0
let pendingSnapshot: LiveState | null = null
let snapshotTimer: ReturnType<typeof setTimeout> | null = null

/** Persist where the presentation is (at most once a second, always including the latest state) so a crash can resume. */
function scheduleLiveSnapshot(state: LiveState): void {
  pendingSnapshot = state
  if (snapshotTimer) return
  const wait = Math.max(0, 1000 - (Date.now() - lastLiveSave))
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    const s = pendingSnapshot
    pendingSnapshot = null
    lastLiveSave = Date.now()
    if (!s || !repos) return
    try {
      if (s.serviceId && s.itemId) {
        repos.settings.setState('live.snapshot', { serviceId: s.serviceId, itemId: s.itemId, slideIndex: s.slideIndex, at: new Date().toISOString() })
      } else if (!s.itemId) repos.settings.deleteState('live.snapshot')
    } catch (e) {
      log.warn('live snapshot failed', e)
    }
  }, wait)
}

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function broadcast<E extends IpcEvent>(event: E, payload: IpcEvents[E]): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(event, payload)
}

function sendToOperator<E extends IpcEvent>(event: E, payload: IpcEvents[E]): void {
  if (operatorWin && !operatorWin.isDestroyed()) operatorWin.webContents.send(event, payload)
}

// ------------------------------------------------------------------ database

function initDatabase(): void {
  const file = paths.database()
  const opened = openDatabase(file, (conn, from) => {
    log.info(`migrating database from v${from}; taking safety backup`)
    createBackupSync(conn, 'premigration')
  })
  db = opened.db
  repos = createRepos(db)
  if (opened.applied.length) log.info('migrations applied', opened.applied)
  repos.themes.ensureBuiltins()
  seedBibles(repos)
  relinkDemoMedia(repos)

  // Crash detection: the flag is cleared only on a clean quit.
  crashedLastRun = repos.settings.getState('session.running', false)
  repos.settings.setState('session.running', true)

  // One automatic backup per day.
  const s = repos.settings.get()
  const last = s.backup.lastBackupAt ? Date.parse(s.backup.lastBackupAt) : 0
  if (s.backup.autoBackup && Date.now() - last > 20 * 3600 * 1000 && repos.services.count() + repos.songs.count() > 0) {
    try {
      const b = createBackupSync(db, 'auto')
      repos.settings.save({ backup: { lastBackupAt: b.createdAt } })
      pruneBackups(s.backup.keep)
    } catch (e) {
      log.error('auto backup failed', e)
    }
  }
}

/** Match native chrome (dialogs, menus, title bar) to the operator appearance. */
function applyAppearance(s: AppSettings): void {
  const mode = s.appearance
  nativeTheme.themeSource = mode === 'light' || mode === 'dark' ? mode : 'system'
  operatorWin?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#070b16' : '#f2f5fb')
}

function recovery(): RecoveryInfo {
  return {
    crashed: crashedLastRun,
    lastLive: repos.settings.getState('live.snapshot', null),
    drafts: repos.drafts.list()
  }
}

function restoreDatabase(file: string): void {
  log.warn('restoring database from', file)
  try {
    createBackupSync(db, 'prerestore')
  } catch (e) {
    log.error('pre-restore backup failed', e)
  }
  output.close()
  db.close()
  replaceDatabaseFile(file, paths.database())
  quitting = true
  app.relaunch()
  app.exit(0)
}

// ------------------------------------------------------------------ windows

function createOperatorWindow(): void {
  const wa = screen.getPrimaryDisplay().workArea
  operatorWin = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: Math.min(1600, wa.width),
    height: Math.min(1000, wa.height),
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: BRAND.name,
    // Packaged builds take the icon from the app bundle / .exe; `npm run dev` would show Electron's
    ...(!app.isPackaged && process.platform !== 'darwin' ? { icon: join(app.getAppPath(), 'build', 'icon.ico') } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#070b16' : '#f2f5fb',
    // macOS: traffic lights inset into the header. Windows: native caption buttons drawn over
    // the header (the renderer keeps their colours in step with the appearance via app:titleBar).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 14 } }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: nativeTheme.shouldUseDarkColors ? { color: '#0d1220', symbolColor: '#e8ecf6', height: 44 } : { color: '#ffffff', symbolColor: '#0b1533', height: 44 }
        }),
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true, webviewTag: true }
  })
  hardenWindow(operatorWin)
  operatorWin.once('ready-to-show', () => {
    operatorWin?.show()
    if (wa.width < 1500) operatorWin?.maximize()
  })

  operatorWin.on('close', (e) => {
    if (quitting) return
    const live = output.window !== null
    if (!live && !unsaved) return
    const choice = dialog.showMessageBoxSync(operatorWin!, {
      type: 'warning',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: live ? 'A presentation is currently live.' : 'You have unsaved changes.',
      detail: live
        ? 'Quitting will close the audience output. Are you sure?'
        : 'Your edits are kept as a recovery draft, but have not been saved. Quit anyway?'
    })
    if (choice === 1) e.preventDefault()
  })
  operatorWin.on('closed', () => {
    operatorWin = null
    app.quit()
  })
  operatorWin.webContents.on('render-process-gone', (_e, details) => {
    log.error('operator renderer gone', details)
    if (details.reason !== 'clean-exit') setTimeout(() => operatorWin && void loadEntry(operatorWin, 'index'), 300)
  })
  void loadEntry(operatorWin, 'index')
}

// ------------------------------------------------------------------ lifecycle

app.on('second-instance', () => {
  if (operatorWin) {
    if (operatorWin.isMinimized()) operatorWin.restore()
    operatorWin.focus()
  }
})

app.whenReady().then(() => {
  try {
    initDatabase()
  } catch (e) {
    log.error('database init failed', e)
    dialog.showErrorBox(
      `${BRAND.name} could not open its database`,
      `${e instanceof Error ? e.message : String(e)}\n\nYour backups are in:\n${paths.backups()}`
    )
    app.exit(1)
    return
  }

  applyAppearance(repos.settings.get())
  if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(join(app.getAppPath(), 'build', 'icon.png'))
  setupWebSandbox()

  handleMediaProtocol(repos.media.pathOf, (id) => {
    try {
      const m = repos.media.get(id)
      if (m && !m.missing) {
        repos.media.update(id, { missing: true })
        broadcast('media:changed', undefined)
      }
    } catch (e) {
      log.warn('missing-media flag failed', e)
    }
  })

  output = new OutputManager(
    () => operatorWin,
    () => repos.settings.get(),
    (status) => sendToOperator('output:status', status),
    (level, message) => sendToOperator('app:notice', { level, message })
  )

  const ctx: AppContext = {
    repos,
    output,
    operator: () => operatorWin,
    broadcast,
    sendToOperator,
    onLiveUpdate: (state: LiveState) => {
      output.pushState(state)
      scheduleLiveSnapshot(state)
    },
    onSettingsChanged: applyAppearance,
    recovery,
    // Drafts are kept: editors offer them when the item is next opened.
    clearRecovery: () => {
      crashedLastRun = false
    },
    setUnsaved: (v) => {
      unsaved = v
    },
    restoreDatabase,
    loadDemo: async () => {
      const serviceId = seedDemo(repos)
      for (const m of repos.media.list().filter((x) => x.demo && !x.hasThumbnail)) await makeThumbnail(repos, m)
      broadcast('media:changed', undefined)
      return { serviceId }
    },
    removeDemo: () => ({ removed: removeDemo(repos) })
  }
  registerIpc(ctx)
  buildMenu((command) => sendToOperator('app:menu', command), isDev)

  screen.on('display-added', (_e, d) => {
    log.info('display added', d.id, d.label)
    output.onDisplayAdded(d)
    broadcast('displays:changed', listDisplays())
  })
  screen.on('display-removed', (_e, d) => {
    log.info('display removed', d.id, d.label)
    output.onDisplayRemoved(d)
    broadcast('displays:changed', listDisplays())
  })
  screen.on('display-metrics-changed', (_e, d) => {
    output.onDisplayMetricsChanged(d)
    broadcast('displays:changed', listDisplays())
  })

  createOperatorWindow()
  log.info(`${BRAND.name} ${app.getVersion()} started`, { crashedLastRun, data: paths.root() })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  // Clean shutdown: clear crash flag and live snapshot, checkpoint WAL, close DB.
  try {
    if (repos) {
      repos.settings.setState('session.running', false)
      repos.settings.deleteState('live.snapshot')
      db.pragma('wal_checkpoint(TRUNCATE)')
      db.close()
    }
    log.info('clean shutdown')
  } catch (e) {
    log.error('shutdown error', e)
  }
})

app.on('window-all-closed', () => app.quit())
