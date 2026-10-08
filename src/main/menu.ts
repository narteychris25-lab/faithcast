import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { BRAND } from '@shared/brand'

/**
 * Native menu. Commands are sent to the operator renderer as `app:menu`
 * events so all app logic stays in one place. Accelerators avoid keys used
 * for live control (arrows, space, B, C, L...).
 *
 * On Windows the window has no menu bar (the header replaces the title bar):
 * the accelerators still work, and the header's menu button pops this menu up.
 */
export function buildMenu(send: (command: string) => void, isDev: boolean): void {
  const mac = process.platform === 'darwin'
  const cmd = (label: string, command: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(command)
  })
  const settings = cmd('Settings…', 'nav:settings', 'CmdOrCtrl+,')

  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? ([
          {
            label: BRAND.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        cmd('New Service', 'service:new', 'CmdOrCtrl+N'),
        cmd('Open Service…', 'nav:services', 'CmdOrCtrl+O'),
        { type: 'separator' },
        cmd('Import Service Package…', 'service:import'),
        cmd('Export Current Service…', 'service:export', 'CmdOrCtrl+E'),
        { type: 'separator' },
        cmd('Import Songs…', 'songs:import'),
        cmd('Import Media…', 'media:import', 'CmdOrCtrl+I'),
        { type: 'separator' },
        cmd('Back Up Now', 'backup:create'),
        { type: 'separator' },
        ...(mac
          ? ([{ role: 'close' }] as MenuItemConstructorOptions[])
          : ([settings, { type: 'separator' }, { role: 'quit', label: 'Exit' }] as MenuItemConstructorOptions[]))
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        cmd('Dashboard', 'nav:dashboard', 'CmdOrCtrl+1'),
        cmd('Service Planner', 'nav:planner', 'CmdOrCtrl+2'),
        cmd('Live Presentation', 'nav:live', 'CmdOrCtrl+3'),
        cmd('Songs', 'nav:songs', 'CmdOrCtrl+4'),
        cmd('Bible', 'nav:bible', 'CmdOrCtrl+5'),
        cmd('Media', 'nav:media', 'CmdOrCtrl+6'),
        cmd('Themes', 'nav:themes', 'CmdOrCtrl+7'),
        { type: 'separator' },
        cmd('Search', 'search:open', 'CmdOrCtrl+K'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? ([{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : [])
      ]
    },
    {
      label: 'Presentation',
      submenu: [
        cmd('Open Output', 'output:open', 'CmdOrCtrl+Shift+O'),
        cmd('Close Output', 'output:close', 'CmdOrCtrl+Shift+W'),
        cmd('Identify Displays', 'output:identify'),
        { type: 'separator' },
        cmd('Black Screen', 'live:black'),
        cmd('Clear Text', 'live:clear'),
        cmd('Show Logo', 'live:logo')
      ]
    },
    ...(mac ? ([{ role: 'windowMenu' }] as MenuItemConstructorOptions[]) : []),
    {
      role: 'help',
      submenu: [
        cmd(`${BRAND.name} Help`, 'nav:help', mac ? 'CmdOrCtrl+?' : 'F1'),
        cmd('Keyboard Shortcuts', 'nav:help-shortcuts'),
        { type: 'separator' },
        { label: 'Open Data Folder', click: () => void shell.openPath(app.getPath('userData')) },
        ...(mac ? [] : ([{ type: 'separator' }, { label: `About ${BRAND.name}`, click: showAbout }] as MenuItemConstructorOptions[]))
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Windows has no native About panel; show the version in a message box. */
function showAbout(): void {
  const opts = {
    type: 'info' as const,
    title: `About ${BRAND.name}`,
    message: `${BRAND.name} ${app.getVersion()}`,
    detail: `Electron ${process.versions.electron} · Chrome ${process.versions.chrome}`
  }
  const w = BrowserWindow.getFocusedWindow()
  void (w ? dialog.showMessageBox(w, opts) : dialog.showMessageBox(opts))
}
