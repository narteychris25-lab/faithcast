import { cpSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, sep } from 'node:path'
import Database from 'better-sqlite3'
import { BRAND } from '@shared/brand'
import { log } from './log'

const LEGACY_DB = `${BRAND.legacy.slug}.db`
const NEW_DB = `${BRAND.slug}.db`

/** The database (copied separately), Chromium's lock files and caches: not copied, at any depth. */
const SKIP = new Set([
  LEGACY_DB,
  `${LEGACY_DB}-wal`,
  `${LEGACY_DB}-shm`,
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie',
  'lockfile',
  'Cache',
  'Code Cache',
  'GPUCache',
  'GPUPersistentCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GraphiteDawnCache',
  'ShaderCache',
  'GrShaderCache',
  'Service Worker',
  'blob_storage',
  'Crashpad'
])

/**
 * One-time move from the app's previous name. On the first launch under the
 * new name, the old data folder (e.g. "WorshipFlow" or "WorshipFlow Dev") is
 * copied into the new one: database, backups, thumbnails, imported media, logs
 * and remembered UI state. Media paths that pointed into the old folder are
 * re-pointed at the copy. The old folder is left untouched as a fallback.
 *
 * Must run before the database is opened. Never throws: a failure only means
 * the app starts empty, and the old data is still there.
 */
export function migrateLegacyData(userData: string): void {
  try {
    if (existsSync(join(userData, NEW_DB))) return
    const legacyDir = join(dirname(userData), basename(userData).replace(BRAND.name, BRAND.legacy.name))
    if (legacyDir === userData || !existsSync(join(legacyDir, LEGACY_DB))) return

    // Everything except the database, which is copied consistently (including its WAL) below
    for (const entry of readdirSync(legacyDir)) {
      if (SKIP.has(entry)) continue
      cpSync(join(legacyDir, entry), join(userData, entry), {
        recursive: true,
        force: false,
        errorOnExist: false,
        filter: (from) => !SKIP.has(basename(from))
      })
    }

    const src = new Database(join(legacyDir, LEGACY_DB), { readonly: true, fileMustExist: true })
    const image = src.serialize()
    src.close()
    writeFileSync(join(userData, NEW_DB), image)

    const db = new Database(join(userData, NEW_DB))
    try {
      const from = legacyDir + sep
      const to = userData + sep
      const moved = db
        .prepare('UPDATE OR IGNORE media SET path = ? || substr(path, ?) WHERE substr(path, 1, ?) = ?')
        .run(to, from.length + 1, from.length, from).changes
      // The old app may be open right now; don't let the copy look like a crashed session
      db.prepare("UPDATE app_state SET value = 'false' WHERE key = 'session.running'").run()
      log.info(`copied ${BRAND.legacy.name} data from ${legacyDir}`, { mediaRepointed: moved })
    } finally {
      db.close()
    }
  } catch (e) {
    log.error(`could not copy ${BRAND.legacy.name} data`, e)
  }
}
