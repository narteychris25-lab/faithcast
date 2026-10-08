import type { DashboardData, SearchResult } from '@shared/types'
import { bookName, formatReference, parseReference } from '@shared/bible-books'
import type { DB } from '../connection'
import { createSettingsRepo } from './settings'
import { createThemeRepo } from './themes'
import { createSongRepo } from './songs'
import { createServiceRepo } from './services'
import { createMediaRepo } from './media'
import { createBibleRepo } from './bible'
import { createDraftsRepo, createFavoritesRepo, createSlidesRepo } from './misc'
import { likePattern } from './fts'

export function createRepos(db: DB) {
  const settings = createSettingsRepo(db)
  const themes = createThemeRepo(db)
  const songs = createSongRepo(db)
  const services = createServiceRepo(db)
  const media = createMediaRepo(db)
  const bible = createBibleRepo(db)
  const favorites = createFavoritesRepo(db)
  const drafts = createDraftsRepo(db)
  const slides = createSlidesRepo(db)

  function localDate(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  function dashboard(): DashboardData {
    const today = localDate()
    return {
      recent: services.recent(8),
      today: services.onDate(today),
      upcoming: services.upcoming(today, 8),
      counts: {
        songs: songs.count(),
        services: services.count(),
        media: media.count(),
        themes: themes.list().length,
        translations: bible.count()
      }
    }
  }

  function search(query: string, limit = 8): SearchResult[] {
    const q = query.trim()
    if (!q) return []
    const out: SearchResult[] = []
    const like = likePattern(q)

    // Bible reference typed directly ("john 3:16")
    const translations = bible.translations()
    const tid = settings.get().bible.defaultTranslationId ?? translations[0]?.id
    const ref = parseReference(q)
    if (ref && tid) {
      const vs = ref.verseStart ?? 1
      const ve = ref.verseEnd ?? (bible.structure(tid)[ref.book]?.[ref.chapter - 1] ?? vs)
      const verses = bible.passage({ translationId: tid, book: ref.book, chapter: ref.chapter, verseStart: vs, verseEnd: ve })
      if (verses.length) {
        out.push({
          kind: 'bible',
          id: `ref:${ref.book}:${ref.chapter}:${vs}:${ve}`,
          title: formatReference(ref.book, ref.chapter, vs, ve),
          subtitle: verses[0].text.slice(0, 120),
          ref: { translationId: tid, book: ref.book, chapter: ref.chapter, verseStart: vs, verseEnd: ve }
        })
      }
    }

    for (const s of songs.list({ search: q, limit })) {
      out.push({ kind: 'song', id: s.id, title: s.title, subtitle: [s.author, s.firstLine].filter(Boolean).join(' · ') })
    }

    const svc = db
      .prepare(`SELECT id, name, date FROM services WHERE name LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\'
                ORDER BY date DESC LIMIT ?`)
      .all(like, like, limit) as { id: string; name: string; date: string }[]
    for (const s of svc) out.push({ kind: 'service', id: s.id, title: s.name, subtitle: s.date })

    for (const m of media.list({ search: q, limit })) {
      out.push({ kind: 'media', id: m.id, title: m.name, subtitle: m.type })
    }

    for (const t of themes.list().filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, limit)) {
      out.push({ kind: 'theme', id: t.id, title: t.name, subtitle: t.builtin ? 'Built-in theme' : 'Custom theme' })
    }

    const slideHits = db
      .prepare(`SELECT i.id, i.title, i.type, i.service_id, s.name AS service FROM service_items i
                JOIN services s ON s.id = i.service_id
                WHERE i.type IN ('custom','announcement','sermon','prayer','offering','other')
                  AND (i.title LIKE ? ESCAPE '\\' OR i.data LIKE ? ESCAPE '\\') LIMIT ?`)
      .all(like, like, limit) as { id: string; title: string; type: string; service_id: string; service: string }[]
    for (const s of slideHits) {
      out.push({ kind: 'slide', id: s.id, title: s.title, subtitle: `${s.type} in ${s.service}`, serviceId: s.service_id })
    }

    if (tid && !ref && q.length >= 3) {
      for (const v of bible.search(q, tid, limit)) {
        out.push({
          kind: 'bible',
          id: `v:${v.book}:${v.chapter}:${v.verse}`,
          title: `${bookName(v.book)} ${v.chapter}:${v.verse}`,
          subtitle: v.text.slice(0, 120),
          ref: { translationId: tid, book: v.book, chapter: v.chapter, verseStart: v.verse, verseEnd: v.verse }
        })
      }
    }
    return out
  }

  return { db, settings, themes, songs, services, media, bible, favorites, drafts, slides, dashboard, search, localDate }
}

export type Repos = ReturnType<typeof createRepos>
