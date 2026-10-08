import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { BRAND } from '@shared/brand'

/**
 * Native menu. Commands are sent to the operator renderer as `app:menu`
 * events so all app logic stays in one place. Accelerators avoid keys used
 * for live control (arrows, space, B, C, L...).
 */
export function buildMenu(send: (command: string) => void, isDev: boolean): void {
  const cmd = (label: string, command: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(command)
  })

  const template: MenuItemConstructorOptions[] = [
    {
      label: BRAND.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        cmd('Settings…', 'nav:settings', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
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
        { role: 'close' }
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
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        cmd(`${BRAND.name} Help`, 'nav:help', 'CmdOrCtrl+?'),
        cmd('Keyboard Shortcuts', 'nav:help-shortcuts'),
        { type: 'separator' },
        { label: 'Open Data Folder', click: () => void shell.openPath(app.getPath('userData')) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
