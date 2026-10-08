import type { BiblePassage, BibleReference, BibleTranslation, BibleVerse, ScheduledPassage } from '@shared/types'
import { formatReference } from '@shared/bible-books'
import { bool, now, type DB } from '../connection'
import { ftsQuery } from './fts'

/** WorshipFlow's documented Bible exchange format (also used for bundled Bibles). */
export interface WfBibleFile {
  format: 'worshipflow-bible'
  version: 1
  abbreviation: string
  name: string
  language?: string
  license?: string
  books: { number: number; chapters: string[][] }[]
}

const refKey = (book: number, chapter: number, verse: number) => book * 1_000_000 + chapter * 1000 + verse

export function createBibleRepo(db: DB) {
  const translationsStmt = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM bible_verses v WHERE v.translation_id = t.id) AS verse_count
    FROM bible_translations t ORDER BY t.builtin DESC, t.abbreviation`)
  const chapterStmt = db.prepare<[string, number, number], BibleVerse>(
    'SELECT book, chapter, verse, text FROM bible_verses WHERE translation_id = ? AND book = ? AND chapter = ? ORDER BY verse'
  )
  const rangeStmt = db.prepare<[string, number, number, number, number], BibleVerse>(
    `SELECT book, chapter, verse, text FROM bible_verses
     WHERE translation_id = ? AND book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`
  )
  const structureStmt = db.prepare<[string], { book: number; chapter: number; verses: number }>(
    `SELECT book, chapter, MAX(verse) AS verses FROM bible_verses WHERE translation_id = ?
     GROUP BY book, chapter ORDER BY book, chapter`
  )

  const repo = {
    translations(): BibleTranslation[] {
      return (translationsStmt.all() as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        abbreviation: String(r.abbreviation),
        name: String(r.name),
        language: String(r.language),
        license: String(r.license),
        builtin: bool(r.builtin),
        verseCount: Number(r.verse_count)
      }))
    },
    hasTranslation(abbrev: string): boolean {
      return !!db.prepare('SELECT 1 FROM bible_translations WHERE abbreviation = ?').get(abbrev)
    },
    /** For each book: number of verses per chapter (index 0 = chapter 1). */
    structure(translationId: string): Record<number, number[]> {
      const out: Record<number, number[]> = {}
      for (const r of structureStmt.all(translationId)) (out[r.book] ??= [])[r.chapter - 1] = r.verses
      return out
    },
    chapter: (translationId: string, book: number, chapter: number): BibleVerse[] =>
      chapterStmt.all(translationId, book, chapter),
    passage: (ref: BibleReference): BibleVerse[] =>
      rangeStmt.all(ref.translationId, ref.book, ref.chapter, ref.verseStart, ref.verseEnd),
    search(query: string, translationId: string, limit = 100): BibleVerse[] {
      const match = ftsQuery(query)
      if (!match) return []
      const rows = db
        .prepare(
          `SELECT ref, text FROM bible_fts WHERE bible_fts MATCH ? AND translation_id = ? ORDER BY rank LIMIT ?`
        )
        .all(match, translationId, limit) as { ref: number; text: string }[]
      return rows.map((r) => ({
        book: Math.floor(r.ref / 1_000_000),
        chapter: Math.floor((r.ref % 1_000_000) / 1000),
        verse: r.ref % 1000,
        text: r.text
      }))
    },

    /** Import a whole translation in one transaction. Throws on invalid structure. */
    importTranslation(file: WfBibleFile, builtin = false, id: string = crypto.randomUUID()): BibleTranslation {
      const abbrev = file.abbreviation.trim().toUpperCase()
      if (repo.hasTranslation(abbrev)) throw new Error(`A translation with abbreviation "${abbrev}" is already installed.`)
      const insV = db.prepare('INSERT INTO bible_verses (translation_id, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)')
      const insF = db.prepare('INSERT INTO bible_fts (translation_id, ref, text) VALUES (?, ?, ?)')
      db.transaction(() => {
        db.prepare(
          'INSERT INTO bible_translations (id, abbreviation, name, language, license, builtin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, abbrev, file.name.trim(), file.language ?? 'en', file.license ?? '', builtin ? 1 : 0, now())
        for (const b of file.books) {
          b.chapters.forEach((verses, ci) => {
            verses.forEach((text, vi) => {
              if (!text) return
              insV.run(id, b.number, ci + 1, vi + 1, text)
              insF.run(id, refKey(b.number, ci + 1, vi + 1), text)
            })
          })
        }
      })()
      return repo.translations().find((t) => t.id === id)!
    },
    /** What would be affected by removing a translation. */
    usage(id: string): { serviceItems: number; schedule: number } {
      const count = (sql: string) => (db.prepare(sql).get(id) as { n: number }).n
      return {
        serviceItems: count(`SELECT COUNT(*) n FROM service_items WHERE type = 'bible' AND json_extract(data, '$.bible.translationId') = ?`),
        schedule: count('SELECT COUNT(*) n FROM scripture_schedule WHERE translation_id = ?')
      }
    },
    deleteTranslation(id: string): void {
      db.transaction(() => {
        db.prepare('DELETE FROM bible_fts WHERE translation_id = ?').run(id)
        db.prepare('DELETE FROM bible_translations WHERE id = ?').run(id)
        db.prepare('DELETE FROM bible_passages WHERE translation_id = ?').run(id)
        db.prepare('DELETE FROM scripture_schedule WHERE translation_id = ?').run(id)
      })()
    },

    // ------------------------------------------------ recent & favourites

    recordPassage(ref: BibleReference): BiblePassage {
      const abbr =
        (db.prepare('SELECT abbreviation a FROM bible_translations WHERE id = ?').get(ref.translationId) as { a: string } | undefined)
          ?.a ?? ''
      const label = `${formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd)}${abbr ? ` (${abbr})` : ''}`
      db.prepare(`INSERT INTO bible_passages (id, translation_id, book, chapter, verse_start, verse_end, label, used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(translation_id, book, chapter, verse_start, verse_end) DO UPDATE SET used_at = excluded.used_at`).run(
        crypto.randomUUID(),
        ref.translationId,
        ref.book,
        ref.chapter,
        ref.verseStart,
        ref.verseEnd,
        label,
        now()
      )
      return repo.passages(1)[0]
    },
    passages(limit = 30, favoritesOnly = false): BiblePassage[] {
      const rows = db
        .prepare(
          `SELECT p.*, f.ref_id IS NOT NULL AS fav FROM bible_passages p
           LEFT JOIN favorites f ON f.kind = 'passage' AND f.ref_id = p.id
           ${favoritesOnly ? 'WHERE f.ref_id IS NOT NULL' : ''}
           ORDER BY p.used_at DESC LIMIT ?`
        )
        .all(limit) as Record<string, unknown>[]
      return rows.map((r) => ({
        id: String(r.id),
        translationId: String(r.translation_id),
        book: Number(r.book),
        chapter: Number(r.chapter),
        verseStart: Number(r.verse_start),
        verseEnd: Number(r.verse_end),
        label: String(r.label),
        favorite: bool(r.fav),
        usedAt: String(r.used_at)
      }))
    },
    // ------------------------------------------------ scripture schedule

    schedule(): ScheduledPassage[] {
      return (db.prepare('SELECT * FROM scripture_schedule ORDER BY position').all() as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        position: Number(r.position),
        translationId: String(r.translation_id),
        book: Number(r.book),
        chapter: Number(r.chapter),
        verseStart: Number(r.verse_start),
        verseEnd: Number(r.verse_end),
        versesPerSlide: Number(r.verses_per_slide),
        label: String(r.label)
      }))
    },
    addToSchedule(ref: BibleReference, versesPerSlide: number): ScheduledPassage {
      const abbr =
        (db.prepare('SELECT abbreviation a FROM bible_translations WHERE id = ?').get(ref.translationId) as { a: string } | undefined)?.a ?? ''
      const label = `${formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd)}${abbr ? ` (${abbr})` : ''}`
      const id = crypto.randomUUID()
      const pos = ((db.prepare('SELECT MAX(position) m FROM scripture_schedule').get() as { m: number | null }).m ?? -1) + 1
      db.prepare(`INSERT INTO scripture_schedule (id, position, translation_id, book, chapter, verse_start, verse_end, verses_per_slide, label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, pos, ref.translationId, ref.book, ref.chapter, ref.verseStart, ref.verseEnd, versesPerSlide, label, now())
      return repo.schedule().find((x) => x.id === id)!
    },
    removeFromSchedule(id: string): void {
      db.transaction(() => {
        db.prepare('DELETE FROM scripture_schedule WHERE id = ?').run(id)
        repo.schedule().forEach((x, i) => db.prepare('UPDATE scripture_schedule SET position = ? WHERE id = ?').run(i, x.id))
      })()
    },
    reorderSchedule(ids: string[]): ScheduledPassage[] {
      db.transaction(() => {
        const existing = repo.schedule().map((x) => x.id)
        const order = [...ids.filter((i) => existing.includes(i)), ...existing.filter((i) => !ids.includes(i))]
        order.forEach((id, i) => db.prepare('UPDATE scripture_schedule SET position = ? WHERE id = ?').run(i, id))
      })()
      return repo.schedule()
    },
    clearSchedule(): void {
      db.prepare('DELETE FROM scripture_schedule').run()
    },

    count: (): number => (db.prepare('SELECT COUNT(*) c FROM bible_translations').get() as { c: number }).c
  }
  return repo
}
