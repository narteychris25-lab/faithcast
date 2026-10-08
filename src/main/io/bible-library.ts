import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { BibleLibraryEntry, BibleTranslation } from '@shared/types'
import type { Repos } from '../db/repos'
import type { WfBibleFile } from '../db/repos/bible'
import { paths } from '../paths'

/**
 * Optional Bible versions shipped with the app (public-domain or openly
 * licensed only — built by scripts/build-bible-library.mjs). They are installed
 * on demand so the database stays small and first launch stays fast.
 */
interface ManifestEntry extends Omit<BibleLibraryEntry, 'installed'> {
  file: string
}

function libraryDir(): string {
  return join(paths.resources(), 'bibles', 'library')
}

/** Core versions live one folder up (resources/bibles), where first-launch seeding reads them. */
function entryPath(e: ManifestEntry): string {
  return e.core ? join(paths.resources(), 'bibles', e.file) : join(libraryDir(), e.file)
}

function manifest(): ManifestEntry[] {
  const file = join(libraryDir(), 'catalog.json')
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, 'utf8')) as ManifestEntry[]
}

export function listBibleLibrary(repos: Repos): BibleLibraryEntry[] {
  const installed = new Set(repos.bible.translations().map((t) => t.abbreviation))
  return manifest().map(({ file: _f, ...e }) => ({ ...e, installed: installed.has(e.abbreviation) }))
}

export function installLibraryBible(repos: Repos, abbreviation: string): BibleTranslation {
  const entry = manifest().find((e) => e.abbreviation === abbreviation)
  if (!entry || !/^[\w-]+\.wfbible\.json\.gz$/.test(entry.file)) throw new Error('That Bible is not in the library')
  const data = JSON.parse(gunzipSync(readFileSync(entryPath(entry))).toString('utf8')) as WfBibleFile
  return repos.bible.importTranslation(data, !!entry.core)
}
