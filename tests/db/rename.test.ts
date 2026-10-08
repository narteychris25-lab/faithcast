import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'

// FaithCast was called WorshipFlow: its data folder and files must keep working.

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-rename-'))
  process.env.FAITHCAST_DATA_DIR = dir
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

async function open(file: string) {
  const { openDatabase } = await import('../../src/main/db/connection')
  const { createRepos } = await import('../../src/main/db/repos')
  const db = openDatabase(file).db
  const repos = createRepos(db)
  repos.themes.ensureBuiltins()
  return { db, repos }
}

describe('files from WorshipFlow', () => {
  it('imports old .song, .theme and .wfbible files', async () => {
    const { db, repos } = await open(join(dir, 'fc.db'))
    const { songFileContent, parseSongFile } = await import('../../src/main/io/songs')
    const { exportTheme, importThemeFile } = await import('../../src/main/io/themes')
    const { readBibleFile } = await import('../../src/main/io/bible')

    const song = repos.songs.save({ title: 'Old Song', sections: [] })
    writeFileSync(join(dir, 'old.song'), songFileContent([song]).replace('"faithcast-song"', '"worshipflow-song"'))
    expect(parseSongFile(join(dir, 'old.song'))[0].title).toBe('Old Song')

    const theme = repos.themes.list()[0]
    exportTheme(repos, theme, join(dir, 'new.theme'))
    writeFileSync(join(dir, 'old.theme'), readFileSync(join(dir, 'new.theme'), 'utf8').replace('"faithcast-theme"', '"worshipflow-theme"'))
    expect(importThemeFile(repos, join(dir, 'old.theme')).settings).toEqual(theme.settings)

    const bible = { format: 'worshipflow-bible', version: 1, abbreviation: 'OLD', name: 'Old Version', language: 'en', books: [{ number: 1, chapters: [['In the beginning']] }] }
    writeFileSync(join(dir, 'OLD.wfbible.json.gz'), gzipSync(JSON.stringify(bible)))
    const read = readBibleFile(join(dir, 'OLD.wfbible.json.gz'))
    expect(read.format).toBe('faithcast-bible')
    expect(read.books[0].chapters[0][0]).toBe('In the beginning')
    db.close()
  })

  it('lists and restores old worshipflow-*.db backups', async () => {
    const { db } = await open(join(dir, 'fc.db'))
    const { createBackupSync, listBackups } = await import('../../src/main/backup')
    const b = createBackupSync(db, 'manual')
    const legacy = join(dir, 'backups', 'worshipflow-2026-10-01_09-00-00-auto.db')
    writeFileSync(legacy, readFileSync(b.file))
    const list = listBackups()
    expect(list.map((x) => x.name)).toContain('worshipflow-2026-10-01_09-00-00-auto.db')
    expect(list.find((x) => x.file === legacy)?.reason).toBe('auto')
    expect(list.find((x) => x.file === b.file)?.name.startsWith('faithcast-')).toBe(true)
    db.close()
  })
})

describe('WorshipFlow data folder', () => {
  it('is copied into the FaithCast folder on first launch, with media re-pointed', async () => {
    const appData = join(dir, 'appData')
    const oldDir = join(appData, 'WorshipFlow')
    const newDir = join(appData, 'FaithCast')
    mkdirSync(join(oldDir, 'library'), { recursive: true })
    mkdirSync(join(oldDir, 'Local Storage', 'leveldb'), { recursive: true })
    writeFileSync(join(oldDir, 'Local Storage', 'leveldb', 'CURRENT'), 'x')
    writeFileSync(join(oldDir, 'SingletonLock'), 'pid')
    const inside = join(oldDir, 'library', 'photo.jpg')
    const outside = join(dir, 'elsewhere.jpg')
    writeFileSync(inside, 'jpg')
    writeFileSync(outside, 'jpg')

    const old = await open(join(oldDir, 'worshipflow.db'))
    old.repos.songs.save({ title: 'Amazing Grace', sections: [] })
    old.repos.media.insert({ name: 'inside', type: 'image', path: inside, size: 3, folder: '' })
    old.repos.media.insert({ name: 'outside', type: 'image', path: outside, size: 3, folder: '' })
    old.repos.settings.setState('session.running', true) // as if WorshipFlow is still open
    old.db.close()

    const { migrateLegacyData } = await import('../../src/main/legacy')
    migrateLegacyData(newDir)

    expect(existsSync(join(newDir, 'faithcast.db'))).toBe(true)
    expect(existsSync(join(newDir, 'library', 'photo.jpg'))).toBe(true)
    expect(existsSync(join(newDir, 'Local Storage', 'leveldb', 'CURRENT'))).toBe(true)
    expect(existsSync(join(newDir, 'SingletonLock'))).toBe(false)
    expect(existsSync(join(newDir, 'worshipflow.db'))).toBe(false)
    expect(existsSync(join(oldDir, 'worshipflow.db'))).toBe(true) // old folder untouched

    const copy = await open(join(newDir, 'faithcast.db'))
    expect(copy.repos.songs.list({ limit: 10 }).map((s) => s.title)).toContain('Amazing Grace')
    const paths = Object.fromEntries(copy.repos.media.list().map((m) => [m.name, m.path]))
    expect(paths.inside).toBe(join(newDir, 'library', 'photo.jpg'))
    expect(paths.outside).toBe(outside)
    expect(copy.repos.settings.getState('session.running', true)).toBe(false)
    copy.repos.songs.save({ title: 'Added in FaithCast', sections: [] })
    copy.db.close()

    // Later launches never copy again
    migrateLegacyData(newDir)
    const again = await open(join(newDir, 'faithcast.db'))
    expect(again.repos.songs.list({ limit: 10 }).map((s) => s.title)).toContain('Added in FaithCast')
    again.db.close()
  })

  it('does nothing when there is no WorshipFlow data', async () => {
    const { migrateLegacyData } = await import('../../src/main/legacy')
    const newDir = join(dir, 'appData', 'FaithCast')
    mkdirSync(newDir, { recursive: true })
    migrateLegacyData(newDir)
    expect(existsSync(join(newDir, 'faithcast.db'))).toBe(false)
  })
})
