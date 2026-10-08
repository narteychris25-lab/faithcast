import type { CustomSlide } from '@shared/types'
import { now, parseJson, type DB } from '../connection'

export type FavoriteKind = 'song' | 'media' | 'passage' | 'theme' | 'service'

export function createFavoritesRepo(db: DB) {
  return {
    toggle(kind: FavoriteKind, refId: string): boolean {
      const exists = db.prepare('SELECT 1 FROM favorites WHERE kind = ? AND ref_id = ?').get(kind, refId)
      if (exists) {
        db.prepare('DELETE FROM favorites WHERE kind = ? AND ref_id = ?').run(kind, refId)
        return false
      }
      db.prepare('INSERT INTO favorites (kind, ref_id, created_at) VALUES (?, ?, ?)').run(kind, refId, now())
      return true
    },
    list(kind: FavoriteKind): string[] {
      return (db.prepare('SELECT ref_id FROM favorites WHERE kind = ? ORDER BY created_at DESC').all(kind) as {
        ref_id: string
      }[]).map((r) => r.ref_id)
    }
  }
}

/** Unsaved editor content kept for crash recovery. */
export function createDraftsRepo(db: DB) {
  return {
    save(key: string, label: string, data: unknown): void {
      db.prepare(`INSERT INTO drafts (key, label, data, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET label = excluded.label, data = excluded.data, updated_at = excluded.updated_at`).run(
        key,
        label,
        JSON.stringify(data),
        now()
      )
    },
    get<T>(key: string): T | null {
      const r = db.prepare('SELECT data FROM drafts WHERE key = ?').get(key) as { data: string } | undefined
      return r ? parseJson<T | null>(r.data, null) : null
    },
    list(): { key: string; label: string; updatedAt: string }[] {
      return (db.prepare('SELECT key, label, updated_at FROM drafts ORDER BY updated_at DESC').all() as {
        key: string
        label: string
        updated_at: string
      }[]).map((r) => ({ key: r.key, label: r.label, updatedAt: r.updated_at }))
    },
    delete(key: string): void {
      db.prepare('DELETE FROM drafts WHERE key = ?').run(key)
    },
    clear(): void {
      db.prepare('DELETE FROM drafts').run()
    }
  }
}

export interface SavedSlideDeck {
  id: string
  name: string
  slides: CustomSlide[]
  createdAt: string
  updatedAt: string
}

/** Reusable custom slides library ("slides" table). */
export function createSlidesRepo(db: DB) {
  const toDeck = (r: Record<string, string>): SavedSlideDeck => ({
    id: r.id,
    name: r.name,
    slides: parseJson<CustomSlide[]>(r.data, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  })
  return {
    list(): SavedSlideDeck[] {
      return (db.prepare('SELECT * FROM slides ORDER BY name COLLATE NOCASE').all() as Record<string, string>[]).map(toDeck)
    },
    save(deck: { id?: string; name: string; slides: CustomSlide[] }): SavedSlideDeck {
      const id = deck.id ?? crypto.randomUUID()
      const t = now()
      db.prepare(`INSERT INTO slides (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`).run(
        id,
        deck.name.trim() || 'Untitled slides',
        JSON.stringify(deck.slides),
        t,
        t
      )
      return toDeck(db.prepare('SELECT * FROM slides WHERE id = ?').get(id) as Record<string, string>)
    },
    delete(id: string): void {
      db.prepare('DELETE FROM slides WHERE id = ?').run(id)
    }
  }
}
