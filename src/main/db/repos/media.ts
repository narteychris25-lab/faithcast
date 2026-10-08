import type { MediaItem, MediaType } from '@shared/types'
import { bool, now, parseJson, type DB } from '../connection'
import { likePattern } from './fts'

interface MediaRow {
  id: string
  name: string
  type: MediaType
  path: string
  size: number
  width: number | null
  height: number | null
  duration: number | null
  tags: string
  folder: string
  has_thumbnail: number
  missing: number
  demo: number
  created_at: string
  updated_at: string
  fav: number | null
}

export interface MediaQuery {
  type?: MediaType
  search?: string
  favorites?: boolean
  folder?: string
  limit?: number
  offset?: number
}

export interface MediaInsert {
  name: string
  type: MediaType
  path: string
  size: number
  width?: number | null
  height?: number | null
  duration?: number | null
  folder?: string
  demo?: boolean
}

const SELECT = `SELECT m.*, f.ref_id IS NOT NULL AS fav FROM media m
  LEFT JOIN favorites f ON f.kind = 'media' AND f.ref_id = m.id`

const toMedia = (r: MediaRow): MediaItem => ({
  id: r.id,
  name: r.name,
  type: r.type,
  path: r.path,
  size: r.size,
  width: r.width,
  height: r.height,
  duration: r.duration,
  tags: parseJson(r.tags, []),
  favorite: bool(r.fav),
  folder: r.folder,
  hasThumbnail: bool(r.has_thumbnail),
  missing: bool(r.missing),
  demo: bool(r.demo),
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

export function createMediaRepo(db: DB) {
  const one = db.prepare<[string], MediaRow>(`${SELECT} WHERE m.id = ?`)
  const byPath = db.prepare<[string], MediaRow>(`${SELECT} WHERE m.path = ?`)

  const repo = {
    get(id: string): MediaItem | null {
      const r = one.get(id)
      return r ? toMedia(r) : null
    },
    getByPath(path: string): MediaItem | null {
      const r = byPath.get(path)
      return r ? toMedia(r) : null
    },
    /** Path lookup used by the media protocol on every request, so kept minimal. */
    pathOf: (() => {
      const stmt = db.prepare<[string], { path: string }>('SELECT path FROM media WHERE id = ?')
      return (id: string): string | null => stmt.get(id)?.path ?? null
    })(),
    list(q: MediaQuery = {}): MediaItem[] {
      const where: string[] = []
      const params: Record<string, unknown> = { limit: Math.min(q.limit ?? 10000, 10000), offset: q.offset ?? 0 }
      if (q.type) {
        where.push('m.type = @type')
        params.type = q.type
      }
      if (q.favorites) where.push('f.ref_id IS NOT NULL')
      if (q.folder) {
        where.push('m.folder = @folder')
        params.folder = q.folder
      }
      if (q.search?.trim()) {
        where.push("(m.name LIKE @s ESCAPE '\\' OR m.tags LIKE @s ESCAPE '\\' OR m.folder LIKE @s ESCAPE '\\')")
        params.s = likePattern(q.search.trim())
      }
      const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.created_at DESC, m.name COLLATE NOCASE LIMIT @limit OFFSET @offset`
      return (db.prepare(sql).all(params) as MediaRow[]).map(toMedia)
    },
    insert(m: MediaInsert): MediaItem {
      const existing = repo.getByPath(m.path)
      if (existing) return existing
      const id = crypto.randomUUID()
      const t = now()
      db.prepare(`INSERT INTO media (id, name, type, path, size, width, height, duration, folder, demo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        m.name,
        m.type,
        m.path,
        m.size,
        m.width ?? null,
        m.height ?? null,
        m.duration ?? null,
        m.folder ?? '',
        m.demo ? 1 : 0,
        t,
        t
      )
      return repo.get(id)!
    },
    update(
      id: string,
      patch: Partial<Pick<MediaItem, 'name' | 'tags' | 'folder' | 'width' | 'height' | 'duration' | 'hasThumbnail' | 'missing' | 'path' | 'size'>>
    ): MediaItem {
      const cur = repo.get(id)
      if (!cur) throw new Error('Media not found')
      db.prepare(`UPDATE media SET name=?, tags=?, folder=?, width=?, height=?, duration=?, has_thumbnail=?, missing=?,
        path=?, size=?, updated_at=? WHERE id=?`).run(
        patch.name?.trim() || cur.name,
        JSON.stringify(patch.tags ?? cur.tags),
        patch.folder ?? cur.folder,
        patch.width !== undefined ? patch.width : cur.width,
        patch.height !== undefined ? patch.height : cur.height,
        patch.duration !== undefined ? patch.duration : cur.duration,
        (patch.hasThumbnail ?? cur.hasThumbnail) ? 1 : 0,
        (patch.missing ?? cur.missing) ? 1 : 0,
        patch.path ?? cur.path,
        patch.size ?? cur.size,
        now(),
        id
      )
      return repo.get(id)!
    },
    delete(id: string): void {
      db.transaction(() => {
        db.prepare("DELETE FROM favorites WHERE kind = 'media' AND ref_id = ?").run(id)
        db.prepare('DELETE FROM media WHERE id = ?').run(id)
      })()
    },
    folders(): string[] {
      return (
        db.prepare("SELECT DISTINCT folder FROM media WHERE folder <> '' ORDER BY folder COLLATE NOCASE").all() as {
          folder: string
        }[]
      ).map((r) => r.folder)
    },
    allPaths(): { id: string; path: string; missing: boolean }[] {
      return (db.prepare('SELECT id, path, missing FROM media').all() as { id: string; path: string; missing: number }[]).map(
        (r) => ({ id: r.id, path: r.path, missing: bool(r.missing) })
      )
    },
    count: (): number => (db.prepare('SELECT COUNT(*) c FROM media').get() as { c: number }).c
  }
  return repo
}
