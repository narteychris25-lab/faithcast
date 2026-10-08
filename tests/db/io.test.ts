import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wf-io-'))
  process.env.WORSHIPFLOW_DATA_DIR = dir
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

async function fresh() {
  const { openDatabase } = await import('../../src/main/db/connection')
  const { createRepos } = await import('../../src/main/db/repos')
  const db = openDatabase(join(dir, 'wf.db')).db
  const repos = createRepos(db)
  repos.themes.ensureBuiltins()
  return { db, repos }
}

describe('song import/export', () => {
  it('parses plain text with metadata headers', async () => {
    const { parseTextSong } = await import('../../src/main/io/songs')
    const s = parseTextSong('Title: My Song\nAuthor: A. Writer\nCCLI: 123\n\n[Verse 1]\nHello\n\n[Chorus]\nWorld', 'fallback')
    expect(s.title).toBe('My Song')
    expect(s.author).toBe('A. Writer')
    expect(s.ccli).toBe('123')
    expect(s.sections.map((x) => x.label)).toEqual(['Verse 1', 'Chorus'])
  })

  it('parses a CCLI SongSelect style export', async () => {
    const { parseTextSong } = await import('../../src/main/io/songs')
    const s = parseTextSong('Great Song\n\nVerse 1\nLine a\nLine b\n\nChorus\nLine c\n\nCCLI Song # 7654321\nSomebody\n© 2001 Some Publisher\nFor use solely with the SongSelect Terms of Use.', 'f')
    expect(s.title).toBe('Great Song')
    expect(s.ccli).toBe('7654321')
    expect(s.copyright).toContain('2001 Some Publisher')
    expect(s.sections).toHaveLength(2)
  })

  it('parses OpenLyrics XML with verse order', async () => {
    const { parseOpenLyrics } = await import('../../src/main/io/songs')
    const xml = `<?xml version="1.0"?><song xmlns="http://openlyrics.info/namespace/2009/song"><properties><titles><title>Open Song</title></titles>
      <authors><author>Jane</author></authors><verseOrder>v1 c1 v1</verseOrder></properties>
      <lyrics><verse name="v1"><lines>First<br/>Second</lines></verse><verse name="c1"><lines>Chorus &amp; more</lines></verse></lyrics></song>`
    const s = parseOpenLyrics(xml, 'f')
    expect(s.title).toBe('Open Song')
    expect(s.author).toBe('Jane')
    expect(s.sections[0].text).toBe('First\nSecond')
    expect(s.sections[1].text).toBe('Chorus & more')
    expect(s.arrangement).toHaveLength(3)
  })

  it('round-trips .song files and rejects invalid ones', async () => {
    const { repos, db } = await fresh()
    const { songFileContent, parseSongFile } = await import('../../src/main/io/songs')
    const { parseLyrics } = await import('../../src/shared/lyrics')
    const sections = parseLyrics('[Verse 1]\nA\n[Chorus]\nB')
    const song = repos.songs.save({ title: 'RT', author: 'X', sections, arrangement: [sections[0].id, sections[1].id, sections[1].id] })
    const file = join(dir, 'rt.song')
    writeFileSync(file, songFileContent([song]))
    const [parsed] = parseSongFile(file)
    expect(parsed.title).toBe('RT')
    expect(parsed.arrangement).toHaveLength(3)
    expect(parsed.arrangement![1]).toBe(parsed.sections[1].id)
    writeFileSync(join(dir, 'bad.song'), JSON.stringify({ format: 'nope' }))
    expect(() => parseSongFile(join(dir, 'bad.song'))).toThrow(/Invalid song file/)
    db.close()
  })
})

describe('bible import formats', () => {
  it('reads Zefania XML and CSV', async () => {
    const { readBibleFile } = await import('../../src/main/io/bible')
    const xml = join(dir, 'test.xml')
    writeFileSync(xml, `<XMLBIBLE biblename="Test Bible"><INFORMATION><title>Test Bible</title><identifier>TST</identifier></INFORMATION>
      <BIBLEBOOK bnumber="43"><CHAPTER cnumber="3"><VERS vnumber="16">For God so loved</VERS><VERS vnumber="17">For God sent</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`)
    const z = readBibleFile(xml)
    expect(z.abbreviation).toBe('TST')
    expect(z.books[0].number).toBe(43)
    expect(z.books[0].chapters[2][15]).toBe('For God so loved')

    const csv = join(dir, 'My Bible.csv')
    writeFileSync(csv, 'book,chapter,verse,text\nJohn,3,16,"For God, so loved"\n1,1,1,In the beginning\n')
    const c = readBibleFile(csv)
    expect(c.books.find((b) => b.number === 43)!.chapters[2][15]).toBe('For God, so loved')
    expect(c.books.find((b) => b.number === 1)!.chapters[0][0]).toBe('In the beginning')
  })
})

describe('thiagobodruk/bible formats', () => {
  const book = (abbrev: string, chapters: string[][]) => ({ abbrev, name: abbrev, chapters })
  it('reads JSON (all 66 books, by position) and recognises catalogue versions', async () => {
    const { readBibleFileDetailed } = await import('../../src/main/io/bible')
    const books = Array.from({ length: 66 }, (_, i) => book(`x${i}`, [[`b${i + 1} c1 v1`, i === 42 ? 'For God so loved' : 'v2']]))
    books[42].chapters.push([], ['', '', 'jn3:3'])
    books[0].chapters[0].push('[]', 'Text.’[’’]')
    const file = join(dir, 'en_asv.json')
    writeFileSync(file, '\uFEFF' + JSON.stringify(books))
    const { bible, entry } = readBibleFileDetailed(file)
    expect(entry?.name).toBe('American Standard Version 1901')
    expect(bible.abbreviation).toBe('ASV')
    expect(bible.books[42].number).toBe(43)
    expect(bible.books[42].chapters[0][1]).toBe('For God so loved')
    expect(bible.books[0].chapters[0].slice(2)).toEqual(['', 'Text.’']) // artifacts cleaned
  })
  it('maps books by code when some are missing (e.g. Russian Synodal without Esther/Daniel)', async () => {
    const { readBibleFileDetailed } = await import('../../src/main/io/bible')
    const file = join(dir, 'ru_synod.json')
    writeFileSync(file, JSON.stringify([book('gn', [['В начале']]), book('jo', [['Иоанн 1:1']]), book('ap', [['Откровение']])]))
    const { bible, entry } = readBibleFileDetailed(file)
    expect(entry?.status).toBe('public-domain')
    expect(bible.books.map((b) => b.number)).toEqual([1, 43, 66])
  })
  it('reads the XML format and flags copyrighted versions', async () => {
    const { readBibleFileDetailed } = await import('../../src/main/io/bible')
    const file = join(dir, 'en_niv.xml')
    writeFileSync(file, `<?xml version='1.0' encoding='utf-8'?><bible><b id="gn" n="Gênesis"><c n="1"><v n="1">In the beginning &amp; more</v><v n="2">Second</v></c></b><b id="jo" n="João"><c n="3"><v n="16">For God</v></c></b></bible>`)
    const { bible, entry } = readBibleFileDetailed(file)
    expect(entry?.status).toBe('copyrighted')
    expect(bible.abbreviation).toBe('NIV')
    expect(bible.books.find((b) => b.number === 1)!.chapters[0]).toEqual(['In the beginning & more', 'Second'])
    expect(bible.books.find((b) => b.number === 43)!.chapters[2][15]).toBe('For God')
  })
  it('still reads WorshipFlow and Zefania files through the same entry point', async () => {
    const { readBibleFileDetailed } = await import('../../src/main/io/bible')
    const z = join(dir, 'z.xml')
    writeFileSync(z, `<XMLBIBLE biblename="Zed"><BIBLEBOOK bnumber="1"><CHAPTER cnumber="1"><VERS vnumber="1">Z</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`)
    expect(readBibleFileDetailed(z).bible.books[0].chapters[0][0]).toBe('Z')
    expect(readBibleFileDetailed(z).entry).toBeUndefined()
  })
})

describe('service packages', () => {
  it('exports with media and imports on a "different machine" with id remapping', async () => {
    const { repos, db } = await fresh()
    const { exportServicePackage, importServicePackage, exportServiceText } = await import('../../src/main/io/services')
    const { parseLyrics } = await import('../../src/shared/lyrics')
    const img = join(dir, 'bg.jpg')
    writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    const media = repos.media.insert({ name: 'bg', type: 'image', path: img, size: 4 })
    const theme = repos.themes.duplicate('theme-modern')
    const song = repos.songs.save({ title: 'Pkg Song', sections: parseLyrics('[Verse 1]\nHi') })
    const svc = repos.services.create({ name: 'Pkg', date: '2026-10-04', themeId: theme.id })
    repos.services.addItem(svc.id, { type: 'song', title: 'Pkg Song', refId: song.id })
    repos.services.addItem(svc.id, { type: 'image', title: 'bg', data: { mediaId: media.id } })
    const file = join(dir, 'pkg.churchservice')
    exportServicePackage(repos, svc.id, file, true)
    expect(exportServiceText(repos, svc.id, 'txt')).toContain('Pkg Song')
    db.close()

    // New empty database; original media file removed.
    rmSync(join(dir, 'wf.db'))
    rmSync(img)
    const second = await fresh()
    const imported = importServicePackage(second.repos, file)
    expect(imported.items).toHaveLength(2)
    const newMediaId = imported.items[1].data.mediaId!
    expect(newMediaId).not.toBe(media.id)
    const m = second.repos.media.get(newMediaId)!
    expect(existsSync(m.path)).toBe(true) // embedded copy extracted to library
    expect(second.repos.songs.get(imported.items[0].refId!)!.title).toBe('Pkg Song')
    expect(second.repos.themes.get(imported.themeId!)!.name).toContain('Modern')

    writeFileSync(join(dir, 'junk.churchservice'), 'not a zip')
    expect(() => importServicePackage(second.repos, join(dir, 'junk.churchservice'))).toThrow(/not a valid service package/)
    second.db.close()
  })
})

describe('backup and restore', () => {
  it('creates, validates and restores a backup', async () => {
    const { repos, db } = await fresh()
    const { createBackupSync, listBackups, validateBackup, replaceDatabaseFile } = await import('../../src/main/backup')
    repos.services.create({ name: 'Before', date: '2026-10-04' })
    const b = createBackupSync(db, 'manual')
    expect(listBackups().map((x) => x.name)).toContain(b.name)
    validateBackup(b.file)
    repos.services.create({ name: 'After', date: '2026-10-05' })
    db.close()

    writeFileSync(join(dir, 'fake.db'), 'hello')
    expect(() => validateBackup(join(dir, 'fake.db'))).toThrow()

    replaceDatabaseFile(b.file, join(dir, 'wf.db'))
    const check = new Database(join(dir, 'wf.db'), { readonly: true })
    const names = (check.prepare('SELECT name FROM services').all() as { name: string }[]).map((r) => r.name)
    check.close()
    expect(names).toEqual(['Before'])
  })

  it('records crash state and live snapshots for recovery', async () => {
    const { repos, db } = await fresh()
    repos.settings.setState('session.running', true)
    repos.settings.setState('live.snapshot', { serviceId: 's', itemId: 'i', slideIndex: 3, at: 'now' })
    repos.drafts.save('song:1', 'Song: X', { title: 'X' })
    db.close()
    const again = await fresh()
    expect(again.repos.settings.getState('session.running', false)).toBe(true)
    expect(again.repos.settings.getState<{ slideIndex: number } | null>('live.snapshot', null)!.slideIndex).toBe(3)
    expect(again.repos.drafts.get<{ title: string }>('song:1')!.title).toBe('X')
    expect(readFileSync(join(dir, 'wf.db')).length).toBeGreaterThan(0)
    again.db.close()
  })
})
