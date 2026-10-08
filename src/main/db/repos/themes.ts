import type { Theme, ThemeSettings } from '@shared/types'
import { BUILTIN_THEMES, DEFAULT_THEME_SETTINGS, deepMerge } from '@shared/defaults'
import { bool, now, parseJson, type DB } from '../connection'

interface ThemeRow {
  id: string
  name: string
  builtin: number
  settings: string
  created_at: string
  updated_at: string
}

function toTheme(r: ThemeRow): Theme {
  return {
    id: r.id,
    name: r.name,
    builtin: bool(r.builtin),
    // Merge over defaults so themes saved by older versions gain new fields.
    settings: deepMerge(DEFAULT_THEME_SETTINGS, parseJson(r.settings, {})),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function createThemeRepo(db: DB) {
  const all = db.prepare<[], ThemeRow>('SELECT * FROM themes ORDER BY builtin DESC, name COLLATE NOCASE')
  const one = db.prepare<[string], ThemeRow>('SELECT * FROM themes WHERE id = ?')
  const insert = db.prepare(
    'INSERT INTO themes (id, name, builtin, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const update = db.prepare('UPDATE themes SET name = ?, settings = ?, updated_at = ? WHERE id = ?')
  const del = db.prepare('DELETE FROM themes WHERE id = ? AND builtin = 0')

  return {
    list: (): Theme[] => all.all().map(toTheme),
    get: (id: string): Theme | null => {
      const r = one.get(id)
      return r ? toTheme(r) : null
    },
    create(name: string, settings: ThemeSettings, id: string = crypto.randomUUID(), builtin = false): Theme {
      const t = now()
      insert.run(id, name.trim() || 'Untitled theme', builtin ? 1 : 0, JSON.stringify(settings), t, t)
      return this.get(id)!
    },
    update(id: string, patch: { name?: string; settings?: ThemeSettings }): Theme {
      const cur = this.get(id)
      if (!cur) throw new Error('Theme not found')
      update.run(patch.name?.trim() || cur.name, JSON.stringify(patch.settings ?? cur.settings), now(), id)
      return this.get(id)!
    },
    duplicate(id: string): Theme {
      const cur = this.get(id)
      if (!cur) throw new Error('Theme not found')
      return this.create(`${cur.name} Copy`, cur.settings)
    },
    /** Undo all edits to a built-in theme (name and settings as shipped). */
    reset(id: string): Theme {
      const b = BUILTIN_THEMES.find((x) => x.id === id)
      if (!b || !this.get(id)?.builtin) throw new Error('Only built-in themes can be reset')
      update.run(b.name, JSON.stringify(b.settings), now(), id)
      return this.get(id)!
    },
    delete(id: string): void {
      const cur = this.get(id)
      if (cur?.builtin) throw new Error('Built-in themes cannot be deleted. Use “Reset to original” to undo your changes.')
      del.run(id)
    },
    /** Insert any missing built-in themes (idempotent; runs at every start). */
    ensureBuiltins(): void {
      db.transaction(() => {
        for (const b of BUILTIN_THEMES) if (!one.get(b.id)) this.create(b.name, b.settings, b.id, true)
      })()
    }
  }
}
