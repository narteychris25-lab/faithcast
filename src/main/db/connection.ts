import Database from 'better-sqlite3'
import { currentVersion, LATEST_VERSION, migrate } from './migrations'

export type DB = Database.Database

export interface OpenResult {
  db: DB
  migratedFrom: number
  applied: number[]
}

/**
 * Opens (creating if needed) and migrates the database.
 * `beforeMigrate` runs only when an existing database needs migrating, so
 * callers can take a safety backup first.
 */
export function openDatabase(file: string, beforeMigrate?: (db: DB, from: number) => void): OpenResult {
  const db = new Database(file)
  // WAL + FULL sync: readers never block the writer, and committed data
  // survives an application crash or power loss.
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  const check = db.pragma('quick_check', { simple: true })
  if (check !== 'ok') {
    db.close()
    throw new Error(`Database integrity check failed: ${String(check)}`)
  }

  const from = currentVersion(db)
  if (from > 0 && from < LATEST_VERSION && beforeMigrate) beforeMigrate(db, from)
  const applied = migrate(db)
  return { db, migratedFrom: from, applied }
}

// ------------------------------------------------------------- row helpers

export function now(): string {
  return new Date().toISOString()
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const bool = (v: unknown): boolean => v === 1 || v === true
export const int = (v: boolean): number => (v ? 1 : 0)
