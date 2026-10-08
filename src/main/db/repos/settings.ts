import type { AppSettings, Church } from '@shared/types'
import { DEFAULT_CHURCH, deepMerge, mergeSettings } from '@shared/defaults'
import { now, parseJson, type DB } from '../connection'

export function createSettingsRepo(db: DB) {
  const getStmt = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
  const putStmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
  const churchGet = db.prepare<[], { data: string }>('SELECT data FROM church WHERE id = 1')
  const churchPut = db.prepare(
    `INSERT INTO church (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
  const stateGet = db.prepare<[string], { value: string }>('SELECT value FROM app_state WHERE key = ?')
  const statePut = db.prepare(
    'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const stateDel = db.prepare('DELETE FROM app_state WHERE key = ?')

  return {
    get(): AppSettings {
      return mergeSettings(parseJson(getStmt.get('app')?.value, {}))
    },
    /** Deep-merges a partial update and returns the full settings. */
    save(patch: unknown): AppSettings {
      const next = deepMerge(this.get(), patch)
      // Arrays (shortcut bindings) replace rather than merge.
      putStmt.run('app', JSON.stringify(next), now())
      return next
    },
    getChurch(): Church {
      return deepMerge(DEFAULT_CHURCH, parseJson(churchGet.get()?.data, {}))
    },
    saveChurch(patch: Partial<Church>): Church {
      const next = deepMerge(this.getChurch(), patch)
      churchPut.run(JSON.stringify(next), now())
      return next
    },
    getState<T>(key: string, fallback: T): T {
      return parseJson(stateGet.get(key)?.value, fallback)
    },
    setState(key: string, value: unknown): void {
      statePut.run(key, JSON.stringify(value))
    },
    deleteState(key: string): void {
      stateDel.run(key)
    }
  }
}
