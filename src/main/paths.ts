import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * All on-disk locations. FAITHCAST_DATA_DIR overrides the data root so
 * automated tests run against an isolated profile.
 */
function root(): string {
  return process.env.FAITHCAST_DATA_DIR || app.getPath('userData')
}

function ensure(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export const paths = {
  root: () => ensure(root()),
  database: () => join(ensure(root()), 'faithcast.db'),
  backups: () => ensure(join(root(), 'backups')),
  thumbnails: () => ensure(join(root(), 'thumbnails')),
  /** Media copied in by service-package imports and demo content. */
  library: () => ensure(join(root(), 'library')),
  logs: () => ensure(join(root(), 'logs')),
  /** Bundled read-only resources (Bibles, demo media). */
  resources: () => (app.isPackaged ? join(process.resourcesPath, 'resources') : join(app.getAppPath(), 'resources'))
}
