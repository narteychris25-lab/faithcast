import { existsSync, readdirSync, statSync, unlinkSync, copyFileSync, renameSync } from 'node:fs'
import { basename, join } from 'node:path'
import Database from 'better-sqlite3'
import type { BackupInfo } from '@shared/types'
import type { DB } from './db/connection'
import { BRAND } from '@shared/brand'
import { paths } from './paths'

const PREFIX = `${BRAND.slug}-`
/** Backups made before the rename (copied over with the old data folder) */
const LEGACY_PREFIX = `${BRAND.legacy.slug}-`
const EXT = '.db'

function stamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function reasonOf(name: string): string {
  const m = /^[a-z]+-[\d_-]+-(\w+)\.db$/.exec(name)
  return m ? m[1] : 'manual'
}

export function listBackups(): BackupInfo[] {
  const dir = paths.backups()
  return readdirSync(dir)
    .filter((f) => (f.startsWith(PREFIX) || f.startsWith(LEGACY_PREFIX)) && f.endsWith(EXT))
    .map((f) => {
      const file = join(dir, f)
      const st = statSync(file)
      return { file, name: f, size: st.size, createdAt: st.mtime.toISOString(), reason: reasonOf(f) }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Online backup using SQLite's backup API — consistent even while the app is
 * writing. Synchronous variant (VACUUM INTO) so it can run during startup
 * and shutdown without awaiting.
 */
export function createBackupSync(db: DB, reason: 'manual' | 'auto' | 'premigration' | 'prerestore' | 'shutdown'): BackupInfo {
  const file = join(paths.backups(), `${PREFIX}${stamp()}-${reason}${EXT}`)
  db.prepare('VACUUM INTO ?').run(file)
  const st = statSync(file)
  return { file, name: basename(file), size: st.size, createdAt: st.mtime.toISOString(), reason }
}

/** Keep the newest `keep` automatic backups; manual backups are never pruned. */
export function pruneBackups(keep: number): void {
  const autos = listBackups().filter((b) => b.reason !== 'manual')
  for (const b of autos.slice(Math.max(1, keep))) {
    try {
      unlinkSync(b.file)
    } catch {
      /* ignore */
    }
  }
}

/** Validate that a file is a FaithCast database before restoring it. */
export function validateBackup(file: string): void {
  if (!existsSync(file)) throw new Error('Backup file not found')
  let probe: Database.Database | null = null
  try {
    probe = new Database(file, { readonly: true, fileMustExist: true })
    const ok = probe.pragma('quick_check', { simple: true })
    if (ok !== 'ok') throw new Error('Backup file is damaged')
    const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const names = new Set(tables.map((t) => t.name))
    for (const t of ['services', 'songs', 'themes', 'settings']) {
      if (!names.has(t)) throw new Error('This file is not a FaithCast backup')
    }
  } catch (e) {
    if (e instanceof Error && /not a database|file is not/i.test(e.message)) throw new Error('This file is not a FaithCast backup')
    throw e
  } finally {
    probe?.close()
  }
}

/**
 * Replace the live database file with a backup. The caller must have closed
 * the database connection; the app relaunches afterwards.
 */
export function replaceDatabaseFile(backupFile: string, dbFile: string): void {
  const tmp = `${dbFile}.restoring`
  copyFileSync(backupFile, tmp)
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(dbFile + suffix)) unlinkSync(dbFile + suffix)
  }
  renameSync(tmp, dbFile) // atomic on the same volume
}
