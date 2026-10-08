import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { openDatabase, type DB } from '../../src/main/db/connection'
import { LATEST_VERSION } from '../../src/main/db/migrations'
import { createRepos, type Repos } from '../../src/main/db/repos'
import type { FcBibleFile } from '../../src/main/db/repos/bible'
import { parseLyrics } from '../../src/shared/lyrics'

let dir: string
let db: DB
let repos: Repos

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-db-'))
  db = openDatabase(join(dir, 'test.db')).db
  repos = createRepos(db)
  repos.themes.ensureBuiltins()
})
afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('database', () => {
  it('creates schema at latest version and reopens without re-migrating', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION)
    db.close()
    const again = openDatabase(join(dir, 'test.db'))
    expect(again.applied).toEqual([])
    db = again.db
    repos = createRepos(db)
  })

  it('persists settings with deep merge and defaults', () => {
    const s = repos.settings.save({ presentation: { aspectRatio: '4:3' } })
    expect(s.presentation.aspectRatio).toBe('4:3')
    expect(s.presentation.defaultTransition.type).toBe('fade')
    expect(repos.settings.get().presentation.aspectRatio).toBe('4:3')
    repos.settings.save({ shortcuts: { next: ['KeyX'] } })
    expect(repos.settings.get().shortcuts.next).toEqual(['KeyX'])
    expect(repos.settings.get().shortcuts.previous.length).toBeGreaterThan(0)
  })

  it('church profile round-trips', () => {
    repos.settings.saveChurch({ name: 'Grace Chapel', social: { facebook: 'fb', instagram: '', youtube: '', x: '' } })
    expect(repos.settings.getChurch().name).toBe('Grace Chapel')
    expect(repos.settings.getChurch().social.facebook).toBe('fb')
  })

  it('built-in themes are installed once and protected', () => {
    repos.themes.ensureBuiltins()
    const list = repos.themes.list()
    expect(list.filter((t) => t.builtin).length).toBe(8)
    expect(() => repos.themes.delete('theme-classic')).toThrow()
    const copy = repos.themes.duplicate('theme-classic')
    expect(copy.builtin).toBe(false)
    repos.themes.delete(copy.id)
    expect(repos.themes.get(copy.id)).toBeNull()
  })

  it('built-in themes can be edited, keep edits across restarts, and reset to the original', () => {
    repos.themes.ensureBuiltins()
    const orig = repos.themes.get('theme-classic')!
    const edited = repos.themes.update('theme-classic', { name: 'Classic (ours)', settings: { ...orig.settings, maxLines: 2 } })
    expect(edited).toMatchObject({ name: 'Classic (ours)', builtin: true })
    expect(edited.settings.maxLines).toBe(2)
    repos.themes.ensureBuiltins() // runs at every start; must not undo the church's edits
    expect(repos.themes.get('theme-classic')!.name).toBe('Classic (ours)')
    const reset = repos.themes.reset('theme-classic')
    expect(reset.name).toBe(orig.name)
    expect(reset.settings).toEqual(orig.settings)
    const mine = repos.themes.create('Mine', orig.settings)
    expect(() => repos.themes.reset(mine.id)).toThrow(/Only built-in/)
  })
})

describe('songs', () => {
  it('create, search, update, duplicate, delete', () => {
    const sections = parseLyrics('[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone')
    const song = repos.songs.save({ title: 'Amazing Grace', author: 'John Newton', sections, arrangement: [sections[0].id, sections[1].id, sections[0].id] })
    expect(song.sections).toHaveLength(2)
    expect(song.arrangement).toHaveLength(3)
    expect(repos.songs.list({ search: 'wretch' })[0].id).toBe(song.id)
    expect(repos.songs.list({ search: 'newton' })[0].id).toBe(song.id)
    expect(repos.songs.list({ search: 'amaz' })[0].title).toBe('Amazing Grace')
    expect(repos.songs.list({ search: '"; DROP TABLE songs; --' })).toEqual([])

    const updated = repos.songs.save({ ...song, title: 'Amazing Grace (My Chains)', sections: [song.sections[0]] })
    expect(updated.sections).toHaveLength(1)
    expect(updated.arrangement).toEqual([song.sections[0].id, song.sections[0].id])
    expect(repos.songs.list({ search: 'chains' })[0].title).toContain('My Chains')

    const dup = repos.songs.duplicate(song.id)
    expect(dup.id).not.toBe(song.id)
    expect(dup.sections[0].id).not.toBe(song.sections[0].id)
    expect(dup.arrangement[0]).toBe(dup.sections[0].id)

    repos.songs.delete(song.id)
    expect(repos.songs.get(song.id)).toBeNull()
    expect(repos.songs.list({ search: 'wretch' }).map((s) => s.id)).toEqual([dup.id])
  })
})

describe('services', () => {
  it('manages items: add, insert at position, reorder, duplicate, delete, lock', () => {
    const svc = repos.services.create({ name: 'Sunday Service', date: '2026-10-04' })
    const a = repos.services.addItem(svc.id, { type: 'header', title: 'Welcome' })
    const b = repos.services.addItem(svc.id, { type: 'song', title: 'Song B' })
    const c = repos.services.addItem(svc.id, { type: 'prayer', title: 'Prayer' }, 1)
    expect(repos.services.get(svc.id)!.items.map((i) => i.title)).toEqual(['Welcome', 'Prayer', 'Song B'])

    repos.services.reorder(svc.id, [b.id, a.id, c.id])
    expect(repos.services.get(svc.id)!.items.map((i) => i.title)).toEqual(['Song B', 'Welcome', 'Prayer'])

    const d = repos.services.duplicateItem(a.id)
    expect(repos.services.get(svc.id)!.items.map((i) => i.id)).toEqual([b.id, a.id, d.id, c.id])

    repos.services.updateItem(c.id, { locked: true })
    expect(() => repos.services.updateItem(c.id, { title: 'x' })).toThrow(/locked/)
    repos.services.updateItem(c.id, { hidden: true })
    expect(repos.services.getItem(c.id)!.hidden).toBe(true)

    repos.services.deleteItem(a.id)
    const items = repos.services.get(svc.id)!.items
    expect(items.map((i) => i.position)).toEqual([0, 1, 2])

    const copy = repos.services.duplicate(svc.id)
    expect(copy.items).toHaveLength(3)
    repos.services.delete(svc.id)
    expect(repos.services.get(svc.id)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) c FROM service_items WHERE service_id = ?').get(svc.id)).toEqual({ c: 0 })
  })

  it('dashboard lists recent and today services', () => {
    const today = repos.localDate()
    const s = repos.services.create({ name: 'Today', date: today })
    repos.services.markOpened(s.id)
    const d = repos.dashboard()
    expect(d.today[0].id).toBe(s.id)
    expect(d.recent[0].id).toBe(s.id)
    expect(d.counts.themes).toBe(8)
  })
})

describe('media', () => {
  it('insert is idempotent by path; favourites and search work', () => {
    const m = repos.media.insert({ name: 'Sunrise', type: 'image', path: '/tmp/sunrise.jpg', size: 10 })
    expect(repos.media.insert({ name: 'dup', type: 'image', path: '/tmp/sunrise.jpg', size: 10 }).id).toBe(m.id)
    expect(repos.favorites.toggle('media', m.id)).toBe(true)
    expect(repos.media.list({ favorites: true })).toHaveLength(1)
    expect(repos.media.list({ search: 'sun' })).toHaveLength(1)
    expect(repos.media.list({ search: '%' })).toHaveLength(0)
    repos.media.update(m.id, { tags: ['nature'], missing: true })
    expect(repos.media.get(m.id)!.tags).toEqual(['nature'])
    expect(repos.media.get(m.id)!.missing).toBe(true)
    repos.media.delete(m.id)
    expect(repos.favorites.list('media')).toEqual([])
  })
})

describe('bible', () => {
  it('imports the bundled KJV and queries passages, search and structure', () => {
    const file = JSON.parse(gunzipSync(readFileSync('resources/bibles/KJV.fcbible.json.gz')).toString()) as FcBibleFile
    const t0 = Date.now()
    const tr = repos.bible.importTranslation(file, true)
    expect(Date.now() - t0).toBeLessThan(20000)
    expect(tr.verseCount).toBe(31102)
    const john316 = repos.bible.passage({ translationId: tr.id, book: 43, chapter: 3, verseStart: 16, verseEnd: 18 })
    expect(john316).toHaveLength(3)
    expect(john316[0].text).toMatch(/^For God so loved the world/)
    expect(repos.bible.structure(tr.id)[19]).toHaveLength(150) // Psalms
    expect(repos.bible.search('begotten son', tr.id).some((v) => v.book === 43 && v.chapter === 3 && v.verse === 16)).toBe(true)
    expect(() => repos.bible.importTranslation(file)).toThrow(/already installed/)

    const p = repos.bible.recordPassage({ translationId: tr.id, book: 43, chapter: 3, verseStart: 16, verseEnd: 18 })
    expect(p.label).toBe('John 3:16-18 (KJV)')
    repos.favorites.toggle('passage', p.id)
    expect(repos.bible.passages(10, true)).toHaveLength(1)

    const results = repos.search('jn 3:16')
    expect(results[0].kind).toBe('bible')
    expect(results[0].title).toBe('John 3:16')
  })
})

describe('large libraries', () => {
  it('handles 5,000 media items and 2,000 songs quickly', () => {
    const t0 = Date.now()
    db.transaction(() => {
      for (let i = 0; i < 5000; i++) repos.media.insert({ name: `Clip ${i}`, type: i % 3 === 0 ? 'video' : 'image', path: `/lib/clip-${i}.mp4`, size: 1000 })
      for (let i = 0; i < 2000; i++) repos.songs.save({ title: `Song ${i}`, author: `Writer ${i % 50}`, sections: parseLyrics(`[Verse 1]\nline ${i} grace\nmore words here`) })
    })()
    const insertMs = Date.now() - t0
    const t1 = Date.now()
    expect(repos.media.list({ type: 'video' }).length).toBe(1667)
    expect(repos.media.list({ search: 'Clip 49' }).length).toBeGreaterThan(0)
    expect(repos.songs.list({ search: 'grace' }).length).toBe(2000)
    expect(repos.songs.list({ search: 'line 1999' })[0].title).toBe('Song 1999')
    const queryMs = Date.now() - t1
    expect(queryMs).toBeLessThan(1500)
    console.log(`large library: insert ${insertMs}ms, queries ${queryMs}ms`)
  })
})

describe('scripture schedule', () => {
  it('adds, orders, removes and clears scheduled passages', () => {
    const tr = repos.bible.importTranslation({ format: 'faithcast-bible', version: 1, abbreviation: 'TST', name: 'Test', books: [{ number: 43, chapters: [[], [], Array.from({ length: 20 }, (_, i) => `v${i + 1}`)] }] })
    const a = repos.bible.addToSchedule({ translationId: tr.id, book: 43, chapter: 3, verseStart: 16, verseEnd: 18 }, 1)
    const b = repos.bible.addToSchedule({ translationId: tr.id, book: 43, chapter: 3, verseStart: 1, verseEnd: 3 }, 2)
    expect(a.label).toBe('John 3:16-18 (TST)')
    expect(repos.bible.schedule().map((x) => x.id)).toEqual([a.id, b.id])
    expect(repos.bible.reorderSchedule([b.id, a.id]).map((x) => x.position)).toEqual([0, 1])
    expect(repos.bible.schedule()[0].versesPerSlide).toBe(2)
    repos.bible.removeFromSchedule(b.id)
    expect(repos.bible.schedule()).toHaveLength(1)
    expect(repos.bible.schedule()[0].position).toBe(0)
    repos.bible.clearSchedule()
    expect(repos.bible.schedule()).toEqual([])
  })

  it('reports what uses a translation, and removing it clears its schedule entries', () => {
    const tr = repos.bible.importTranslation({ format: 'faithcast-bible', version: 1, abbreviation: 'TST', name: 'Test', books: [{ number: 43, chapters: [[], [], ['a', 'b']] }] })
    const ref = { translationId: tr.id, book: 43, chapter: 3, verseStart: 1, verseEnd: 2 }
    repos.bible.addToSchedule(ref, 1)
    const svc = repos.services.create({ name: 'Sunday', date: '2026-10-04' })
    repos.services.addItem(svc.id, { type: 'bible', title: 'John 3:1-2', data: { bible: { ...ref, versesPerSlide: 1 } } })
    repos.services.addItem(svc.id, { type: 'song', title: 'Song' })
    expect(repos.bible.usage(tr.id)).toEqual({ serviceItems: 1, schedule: 1 })
    repos.bible.deleteTranslation(tr.id)
    expect(repos.bible.schedule()).toEqual([])
    expect(repos.bible.translations().some((t) => t.id === tr.id)).toBe(false)
    expect(repos.bible.usage(tr.id)).toEqual({ serviceItems: 1, schedule: 0 })
  })
})

describe('migration v1 → v2', () => {
  it('upgrades an existing database, backing it up first and keeping data', async () => {
    const { MIGRATIONS } = await import('../../src/main/db/migrations')
    const Database = (await import('better-sqlite3')).default
    const file = join(dir, 'old.db')
    const old = new Database(file)
    MIGRATIONS[0].up(old)
    old.pragma('user_version = 1')
    old.prepare("INSERT INTO services (id, name, date, created_at, updated_at) VALUES ('s1', 'Old Service', '2026-01-01', 'x', 'x')").run()
    old.close()
    let backedUpFrom = 0
    const { db: upgraded, applied, migratedFrom } = openDatabase(file, (_db, from) => (backedUpFrom = from))
    expect(migratedFrom).toBe(1)
    expect(applied).toEqual([2])
    expect(backedUpFrom).toBe(1)
    expect(upgraded.prepare('SELECT name FROM services').get()).toEqual({ name: 'Old Service' })
    expect(upgraded.prepare("SELECT name FROM sqlite_master WHERE name = 'scripture_schedule'").get()).toBeTruthy()
    upgraded.close()
  })
})
