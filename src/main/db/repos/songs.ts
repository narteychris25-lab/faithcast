import type { Song, SongSection, SongSummary } from '@shared/types'
import { bool, now, parseJson, type DB } from '../connection'
import { ftsQuery } from './fts'

interface SongRow {
  id: string
  title: string
  author: string
  copyright: string
  ccli: string
  category: string
  tags: string
  notes: string
  arrangement: string
  theme_id: string | null
  demo: number
  created_at: string
  updated_at: string
}

export interface SongInput {
  id?: string
  title: string
  author?: string
  copyright?: string
  ccli?: string
  category?: string
  tags?: string[]
  notes?: string
  sections: SongSection[]
  arrangement?: string[]
  themeId?: string | null
  demo?: boolean
}

export interface SongListQuery {
  search?: string
  category?: string
  limit?: number
}

export function createSongRepo(db: DB) {
  const one = db.prepare<[string], SongRow>('SELECT * FROM songs WHERE id = ?')
  const sectionsOf = db.prepare<[string], SongSection & { position: number }>(
    'SELECT id, type, label, text, position FROM song_sections WHERE song_id = ? ORDER BY position'
  )
  const insert = db.prepare(`INSERT INTO songs
    (id, title, author, copyright, ccli, category, tags, notes, arrangement, theme_id, demo, created_at, updated_at)
    VALUES (@id, @title, @author, @copyright, @ccli, @category, @tags, @notes, @arrangement, @theme_id, @demo, @created_at, @updated_at)`)
  const update = db.prepare(`UPDATE songs SET title=@title, author=@author, copyright=@copyright, ccli=@ccli,
    category=@category, tags=@tags, notes=@notes, arrangement=@arrangement, theme_id=@theme_id, updated_at=@updated_at
    WHERE id=@id`)
  const delSections = db.prepare('DELETE FROM song_sections WHERE song_id = ?')
  const insSection = db.prepare(
    'INSERT INTO song_sections (id, song_id, position, type, label, text) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const delFts = db.prepare('DELETE FROM songs_fts WHERE song_id = ?')
  const insFts = db.prepare('INSERT INTO songs_fts (song_id, title, author, lyrics) VALUES (?, ?, ?, ?)')
  const del = db.prepare('DELETE FROM songs WHERE id = ?')
  const firstLine = db.prepare<[string], { text: string }>(
    'SELECT text FROM song_sections WHERE song_id = ? ORDER BY position LIMIT 1'
  )

  const toSummary = (r: SongRow): SongSummary => ({
    id: r.id,
    title: r.title,
    author: r.author,
    category: r.category,
    tags: parseJson(r.tags, []),
    demo: bool(r.demo),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    firstLine: (firstLine.get(r.id)?.text ?? '').split('\n')[0] ?? ''
  })

  const repo = {
    get(id: string): Song | null {
      const r = one.get(id)
      if (!r) return null
      return {
        id: r.id,
        title: r.title,
        author: r.author,
        copyright: r.copyright,
        ccli: r.ccli,
        category: r.category,
        tags: parseJson(r.tags, []),
        notes: r.notes,
        sections: sectionsOf.all(id).map(({ id: sid, type, label, text }) => ({ id: sid, type, label, text })),
        arrangement: parseJson(r.arrangement, []),
        themeId: r.theme_id,
        demo: bool(r.demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }
    },

    list(q: SongListQuery = {}): SongSummary[] {
      const limit = Math.min(q.limit ?? 5000, 5000)
      const where: string[] = []
      const params: Record<string, unknown> = { limit }
      if (q.category) {
        where.push('s.category = @category')
        params.category = q.category
      }
      let sql: string
      const match = q.search ? ftsQuery(q.search) : ''
      if (match) {
        params.match = match
        sql = `SELECT s.* FROM songs_fts f JOIN songs s ON s.id = f.song_id
               WHERE songs_fts MATCH @match ${where.length ? 'AND ' + where.join(' AND ') : ''}
               ORDER BY bm25(songs_fts, 0, 10, 4, 1) LIMIT @limit`
      } else {
        sql = `SELECT s.* FROM songs s ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY s.title COLLATE NOCASE LIMIT @limit`
      }
      return (db.prepare(sql).all(params) as SongRow[]).map(toSummary)
    },

    categories(): string[] {
      return (
        db.prepare("SELECT DISTINCT category FROM songs WHERE category <> '' ORDER BY category COLLATE NOCASE").all() as {
          category: string
        }[]
      ).map((r) => r.category)
    },

    save(input: SongInput): Song {
      const t = now()
      const id = input.id ?? crypto.randomUUID()
      const existing = input.id ? one.get(input.id) : undefined
      const sectionIds = new Set(input.sections.map((s) => s.id))
      const row = {
        id,
        title: input.title.trim() || 'Untitled song',
        author: input.author?.trim() ?? '',
        copyright: input.copyright?.trim() ?? '',
        ccli: input.ccli?.trim() ?? '',
        category: input.category?.trim() ?? '',
        tags: JSON.stringify(input.tags ?? []),
        notes: input.notes ?? '',
        // Drop arrangement entries that point at deleted sections.
        arrangement: JSON.stringify((input.arrangement ?? []).filter((a) => sectionIds.has(a))),
        theme_id: input.themeId ?? null,
        demo: input.demo ? 1 : 0,
        created_at: existing?.created_at ?? t,
        updated_at: t
      }
      db.transaction(() => {
        if (existing) update.run(row)
        else insert.run(row)
        delSections.run(id)
        input.sections.forEach((s, i) => insSection.run(s.id, id, i, s.type, s.label.trim() || s.type, s.text))
        delFts.run(id)
        insFts.run(id, row.title, row.author, input.sections.map((s) => s.text).join('\n'))
      })()
      return repo.get(id)!
    },

    duplicate(id: string): Song {
      const s = repo.get(id)
      if (!s) throw new Error('Song not found')
      const idMap = new Map(s.sections.map((sec) => [sec.id, crypto.randomUUID()]))
      return repo.save({
        ...s,
        id: undefined,
        demo: false,
        title: `${s.title} (Copy)`,
        sections: s.sections.map((sec) => ({ ...sec, id: idMap.get(sec.id)! })),
        arrangement: s.arrangement.map((a) => idMap.get(a) ?? a)
      })
    },

    delete(id: string): void {
      db.transaction(() => {
        delFts.run(id)
        del.run(id)
      })()
    },

    count: (): number => (db.prepare('SELECT COUNT(*) c FROM songs').get() as { c: number }).c
  }
  return repo
}
