import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import type { ServiceItem, ServiceWithItems, Song, Theme } from '@shared/types'
import { formatReference } from '@shared/bible-books'
import type { Repos } from '../db/repos'
import { paths } from '../paths'
import { fromPortable, toPortable } from './songs'
import { BackgroundSchema, ItemInputSchema, parse, ThemeSettingsSchema, z } from '../validation'

/**
 * .churchservice package (ZIP):
 *   manifest.json   — see ServiceManifest below
 *   media/<id>.<ext> — optional embedded media files
 */
const FORMAT = 'worshipflow-service'
const MAX_PACKAGE = 4 * 1024 * 1024 * 1024 // 4 GB
const MAX_MANIFEST = 50 * 1024 * 1024

const ManifestSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  service: z.object({
    name: z.string().max(300),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().max(20).default(''),
    notes: z.string().max(10000).default(''),
    themeId: z.string().max(100).nullable().default(null),
    background: BackgroundSchema.nullable().default(null)
  }),
  items: z.array(ItemInputSchema).max(1000),
  songs: z.array(z.object({ id: z.string().max(100), song: z.any() })).max(1000),
  themes: z.array(z.object({ id: z.string().max(100), name: z.string().max(200), settings: z.unknown() })).max(200),
  media: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().max(300),
        type: z.enum(['image', 'video', 'audio']),
        originalPath: z.string().max(4096),
        file: z.string().max(300).nullable()
      })
    )
    .max(5000),
  translations: z.array(z.object({ id: z.string().max(100), abbreviation: z.string().max(12) })).max(50)
})
type Manifest = z.infer<typeof ManifestSchema>

const MEDIA_KEYS = new Set(['mediaId', 'imageMediaId', 'logoMediaId'])

/** Collect every media id referenced anywhere inside a value. */
function collectMedia(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) value.forEach((v) => collectMedia(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (MEDIA_KEYS.has(k) && typeof v === 'string') out.add(v)
      else collectMedia(v, out)
    }
  }
}

/** Deep-copy `value`, remapping media/theme/translation ids. */
function remap<T>(value: T, maps: { media: Map<string, string>; theme: Map<string, string>; translation: Map<string, string> }): T {
  if (Array.isArray(value)) return value.map((v) => remap(v, maps)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (MEDIA_KEYS.has(k) && typeof v === 'string') out[k] = maps.media.get(v) ?? null
      else if (k === 'themeId' && typeof v === 'string') out[k] = maps.theme.get(v) ?? (v.startsWith('theme-') ? v : null)
      else if (k === 'translationId' && typeof v === 'string') out[k] = maps.translation.get(v) ?? v
      else out[k] = remap(v, maps)
    }
    return out as T
  }
  return value
}

export function exportServicePackage(repos: Repos, serviceId: string, file: string, includeMedia: boolean): void {
  const svc = repos.services.get(serviceId)
  if (!svc) throw new Error('Service not found')

  const songIds = new Set(svc.items.filter((i) => i.type === 'song' && i.refId).map((i) => i.refId!))
  const songs = [...songIds].map((id) => repos.songs.get(id)).filter((s): s is Song => !!s)

  const themeIds = new Set<string>()
  if (svc.themeId) themeIds.add(svc.themeId)
  svc.items.forEach((i) => i.themeId && themeIds.add(i.themeId))
  songs.forEach((s) => s.themeId && themeIds.add(s.themeId))
  const themes = [...themeIds].map((id) => repos.themes.get(id)).filter((t): t is Theme => !!t && !t.builtin)

  const mediaIds = new Set<string>()
  collectMedia(svc, mediaIds)
  collectMedia(themes, mediaIds)

  const zip: Zippable = {}
  const media: Manifest['media'] = []
  for (const id of mediaIds) {
    const m = repos.media.get(id)
    if (!m) continue
    let entry: string | null = null
    if (includeMedia && existsSync(m.path)) {
      entry = `media/${m.id}${extname(m.path).toLowerCase()}`
      // Media are already compressed: store without deflate for speed.
      zip[entry] = [new Uint8Array(readFileSync(m.path)), { level: 0 }]
    }
    media.push({ id: m.id, name: m.name, type: m.type, originalPath: m.path, file: entry })
  }

  const translationIds = new Set(svc.items.map((i) => i.data.bible?.translationId).filter((x): x is string => !!x))
  const translations = repos.bible.translations().filter((t) => translationIds.has(t.id)).map((t) => ({ id: t.id, abbreviation: t.abbreviation }))

  const manifest: Manifest = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    service: { name: svc.name, date: svc.date, time: svc.time, notes: svc.notes, themeId: svc.themeId, background: svc.background },
    items: svc.items.map(stripItem),
    songs: songs.map((s) => ({ id: s.id, song: toPortable(s) })),
    themes: themes.map((t) => ({ id: t.id, name: t.name, settings: t.settings })),
    media,
    translations
  }
  zip['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  writeFileSync(file, zipSync(zip, { level: 6 }))
}

function stripItem(i: ServiceItem) {
  return {
    type: i.type,
    title: i.title,
    refId: i.refId,
    data: i.data,
    themeId: i.themeId,
    background: i.background,
    transition: i.transition,
    hidden: i.hidden,
    locked: i.locked,
    notes: i.notes
  }
}

export function importServicePackage(repos: Repos, file: string): ServiceWithItems {
  if (statSync(file).size > MAX_PACKAGE) throw new Error('Package is too large')
  const buf = new Uint8Array(readFileSync(file))
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(buf, { filter: (f) => f.name === 'manifest.json' || /^media\/[\w-]+\.\w+$/.test(f.name) })
  } catch {
    throw new Error('This file is not a valid service package')
  }
  const raw = entries['manifest.json']
  if (!raw || raw.length > MAX_MANIFEST) throw new Error('Service package has no manifest')
  const manifest = parse(ManifestSchema, JSON.parse(strFromU8(raw)), 'service package')

  return repos.db.transaction(() => {
    const maps = { media: new Map<string, string>(), theme: new Map<string, string>(), translation: new Map<string, string>() }

    // Media: embedded copy → library folder; else original path if present on this machine.
    for (const m of manifest.media) {
      let path = m.originalPath
      if (m.file && entries[m.file]) {
        path = join(paths.library(), `${Date.now()}-${basename(m.file)}`)
        writeFileSync(path, entries[m.file])
      }
      const existing = repos.media.getByPath(path)
      const item =
        existing ??
        repos.media.insert({ name: m.name, type: m.type, path, size: existsSync(path) ? statSync(path).size : 0, folder: 'Imported' })
      if (!existsSync(path)) repos.media.update(item.id, { missing: true })
      maps.media.set(m.id, item.id)
    }

    const installed = repos.bible.translations()
    for (const t of manifest.translations) {
      const match = installed.find((x) => x.abbreviation === t.abbreviation) ?? installed[0]
      if (match) maps.translation.set(t.id, match.id)
    }

    for (const t of manifest.themes) {
      const settings = parse(ThemeSettingsSchema, remap(t.settings, maps), 'theme')
      const existing = repos.themes.list().find((x) => x.name === t.name && !x.builtin)
      maps.theme.set(t.id, existing ? existing.id : repos.themes.create(t.name, settings).id)
    }

    const songMap = new Map<string, string>()
    for (const s of manifest.songs) {
      const input = fromPortable(s.song)
      const existing = repos.songs
        .list({ limit: 5000 })
        .find((x) => x.title.toLowerCase() === input.title.toLowerCase() && x.author.toLowerCase() === (input.author ?? '').toLowerCase())
      songMap.set(s.id, existing ? existing.id : repos.songs.save(input).id)
    }

    const svc = repos.services.create({
      name: manifest.service.name,
      date: manifest.service.date,
      time: manifest.service.time,
      notes: manifest.service.notes,
      themeId: manifest.service.themeId ? (maps.theme.get(manifest.service.themeId) ?? (manifest.service.themeId.startsWith('theme-') ? manifest.service.themeId : null)) : null,
      background: remap(manifest.service.background, maps)
    })
    for (const it of manifest.items) {
      const item = remap(it, maps)
      if (item.type === 'song' && it.refId) item.refId = songMap.get(it.refId) ?? null
      repos.services.addItem(svc.id, { ...item, locked: false })
    }
    return repos.services.get(svc.id)!
  })()
}

/** Human-readable order of service (TXT), spreadsheet (CSV) or raw data (JSON). */
export function exportServiceText(repos: Repos, serviceId: string, format: 'txt' | 'csv' | 'json'): string {
  const svc = repos.services.get(serviceId)
  if (!svc) throw new Error('Service not found')
  const detail = (i: ServiceItem): string => {
    if (i.type === 'song' && i.refId) {
      const s = repos.songs.get(i.refId)
      return s ? [s.author, s.ccli ? `CCLI ${s.ccli}` : ''].filter(Boolean).join(' · ') : ''
    }
    if (i.type === 'bible' && i.data.bible) {
      const b = i.data.bible
      return formatReference(b.book, b.chapter, b.verseStart, b.verseEnd)
    }
    return i.notes
  }
  if (format === 'json') return JSON.stringify({ ...svc, items: svc.items.map((i) => ({ ...stripItem(i), detail: detail(i) })) }, null, 2)
  if (format === 'csv') {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [['#', 'Type', 'Title', 'Detail', 'Hidden']]
    svc.items.forEach((i, n) => rows.push([String(n + 1), i.type, i.title, detail(i), i.hidden ? 'yes' : '']))
    return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
  }
  const lines = [svc.name, `${svc.date}${svc.time ? ' ' + svc.time : ''}`, '']
  svc.items.forEach((i, n) => {
    const d = detail(i)
    lines.push(`${String(n + 1).padStart(2, ' ')}. ${i.type === 'header' ? i.title.toUpperCase() : `${i.title}`}${d ? `  — ${d}` : ''}${i.hidden ? '  (hidden)' : ''}`)
  })
  return lines.join('\n') + '\n'
}
