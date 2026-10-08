import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Song, SongSection } from '@shared/types'
import { newId, parseLyrics, serializeLyrics } from '@shared/lyrics'
import type { SongInput } from '@shared/ipc'
import { parse, SectionSchema, z } from '../validation'
import { BRAND } from '@shared/brand'

/**
 * .song file format (JSON, UTF-8):
 * { "format": "faithcast-song", "version": 1,
 *   "songs": [{ title, author, copyright, ccli, category, tags, notes,
 *               sections: [{ type, label, text }], arrangement: [sectionIndex...] }] }
 */
export const SONG_FORMAT = 'faithcast-song'
const MAX_FILE = 10 * 1024 * 1024

const PortableSong = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(500).default(''),
  copyright: z.string().max(1000).default(''),
  ccli: z.string().max(50).default(''),
  category: z.string().max(100).default(''),
  tags: z.array(z.string().max(60)).max(50).default([]),
  notes: z.string().max(10000).default(''),
  sections: z.array(SectionSchema.omit({ id: true })).max(200),
  arrangement: z.array(z.number().int().min(0)).max(500).default([])
})
const SongFile = z.object({ format: z.enum([SONG_FORMAT, `${BRAND.legacy.slug}-song`]), version: z.literal(1), songs: z.array(PortableSong).max(20000) })

type Portable = z.infer<typeof PortableSong>

export function toPortable(song: Song): Portable {
  const index = new Map(song.sections.map((s, i) => [s.id, i]))
  return {
    title: song.title,
    author: song.author,
    copyright: song.copyright,
    ccli: song.ccli,
    category: song.category,
    tags: song.tags,
    notes: song.notes,
    sections: song.sections.map(({ type, label, text }) => ({ type, label, text })),
    arrangement: song.arrangement.map((id) => index.get(id)).filter((i): i is number => i !== undefined)
  }
}

export function fromPortable(p: Portable): SongInput {
  const sections: SongSection[] = p.sections.map((s) => ({ ...s, id: newId() }))
  return {
    title: p.title,
    author: p.author,
    copyright: p.copyright,
    ccli: p.ccli,
    category: p.category,
    tags: p.tags,
    notes: p.notes,
    sections,
    arrangement: p.arrangement.map((i) => sections[i]?.id).filter((id): id is string => !!id)
  }
}

// ------------------------------------------------------------------ import

export function parseSongFile(file: string): SongInput[] {
  if (statSync(file).size > MAX_FILE) throw new Error('File is too large')
  const raw = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const ext = extname(file).toLowerCase()
  if (ext === '.song' || ext === '.json') {
    const data = parse(SongFile, JSON.parse(raw), 'song file')
    return data.songs.map(fromPortable)
  }
  if (ext === '.xml') return [parseOpenLyrics(raw, basename(file, ext))]
  if (ext === '.txt') return [parseTextSong(raw, basename(file, ext))]
  throw new Error(`Unsupported file type ${ext}`)
}

/**
 * Plain text: optional "Title:", "Author:", "Copyright:", "CCLI:" header
 * lines, then lyrics. Also understands CCLI SongSelect exports, where the
 * first line is the title and the footer holds "CCLI Song # …" and "©".
 */
export function parseTextSong(raw: string, fallbackTitle: string): SongInput {
  let lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const meta: Record<string, string> = {}
  while (lines.length && /^(title|author|copyright|ccli|category|tags)\s*:/i.test(lines[0])) {
    const [k, ...v] = lines.shift()!.split(':')
    meta[k.trim().toLowerCase()] = v.join(':').trim()
  }
  // CCLI footer lines
  const footer: string[] = []
  lines = lines.filter((l) => {
    if (/^CCLI (Song|License)\s*#/i.test(l.trim()) || /^©|^\(c\)|copyright/i.test(l.trim()) || /^For use solely with/i.test(l.trim())) {
      footer.push(l.trim())
      return false
    }
    return true
  })
  const ccliMatch = footer.map((f) => /CCLI Song\s*#\s*(\d+)/i.exec(f)).find(Boolean)
  const copyright = footer.find((f) => /^©|^\(c\)|copyright/i.test(f))

  // SongSelect: first non-empty line is the title when followed by a blank line and no header
  let title = meta.title
  if (!title) {
    const first = lines.findIndex((l) => l.trim())
    if (first >= 0 && !lines[first + 1]?.trim() && !/^\[/.test(lines[first])) {
      const candidate = lines[first].trim()
      const next = lines.slice(first + 1).find((l) => l.trim())
      if (next && /^(verse|chorus|bridge|\[|pre|tag|intro|ending)/i.test(next.trim())) {
        title = candidate
        lines.splice(first, 1)
      }
    }
  }
  const sections = parseLyrics(lines.join('\n'))
  if (!sections.length) throw new Error('No lyrics found')
  return {
    title: title || fallbackTitle,
    author: meta.author ?? '',
    copyright: meta.copyright ?? copyright?.replace(/^©\s*|^\(c\)\s*/i, '') ?? '',
    ccli: meta.ccli ?? ccliMatch?.[1] ?? '',
    category: meta.category ?? '',
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    sections
  }
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

/** Minimal OpenLyrics 0.8/0.9 reader (title, authors, copyright, ccli, verses, verse order). */
export function parseOpenLyrics(xml: string, fallbackTitle: string): SongInput {
  if (!/<song[\s>]/i.test(xml)) throw new Error('Not an OpenLyrics file')
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml)?.[1] ?? '') || fallbackTitle
  const authors = [...xml.matchAll(/<author[^>]*>([\s\S]*?)<\/author>/gi)].map((m) => decode(m[1])).join(', ')
  const copyright = decode(/<copyright>([\s\S]*?)<\/copyright>/i.exec(xml)?.[1] ?? '')
  const ccli = decode(/<ccliNo>([\s\S]*?)<\/ccliNo>/i.exec(xml)?.[1] ?? '')
  const order = decode(/<verseOrder>([\s\S]*?)<\/verseOrder>/i.exec(xml)?.[1] ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const byName = new Map<string, SongSection>()
  const sections: SongSection[] = []
  for (const m of xml.matchAll(/<verse\s+[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gi)) {
    const name = m[1]
    const lines = [...m[2].matchAll(/<lines[^>]*>([\s\S]*?)<\/lines>/gi)].map((l) => decode(l[1]))
    const code = /^([a-z]+)(\d*)([a-z]?)$/i.exec(name)
    const map: Record<string, [SongSection['type'], string]> = {
      v: ['verse', 'Verse'],
      c: ['chorus', 'Chorus'],
      p: ['pre-chorus', 'Pre-Chorus'],
      b: ['bridge', 'Bridge'],
      e: ['ending', 'Ending'],
      i: ['intro', 'Intro'],
      o: ['other', 'Other']
    }
    const [type, label] = map[code?.[1]?.toLowerCase() ?? 'o'] ?? ['other', 'Other']
    const section: SongSection = {
      id: newId(),
      type,
      label: `${label}${code?.[2] ? ` ${code[2]}` : ''}${code?.[3] ?? ''}`,
      text: lines.join('\n\n')
    }
    byName.set(name.toLowerCase(), section)
    sections.push(section)
  }
  if (!sections.length) throw new Error('No verses found in OpenLyrics file')
  const arrangement = order.map((o) => byName.get(o.toLowerCase())?.id).filter((x): x is string => !!x)
  return { title, author: authors, copyright, ccli, sections, arrangement }
}

// ------------------------------------------------------------------ export

export function songToText(song: Song): string {
  const head = [`Title: ${song.title}`]
  if (song.author) head.push(`Author: ${song.author}`)
  if (song.copyright) head.push(`Copyright: ${song.copyright}`)
  if (song.ccli) head.push(`CCLI: ${song.ccli}`)
  if (song.category) head.push(`Category: ${song.category}`)
  if (song.tags.length) head.push(`Tags: ${song.tags.join(', ')}`)
  return `${head.join('\n')}\n\n${serializeLyrics(song.sections)}\n`
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

export function songsToCsv(songs: Song[]): string {
  const rows = [['Title', 'Author', 'Copyright', 'CCLI', 'Category', 'Tags', 'Lyrics']]
  for (const s of songs) rows.push([s.title, s.author, s.copyright, s.ccli, s.category, s.tags.join(', '), serializeLyrics(s.sections)])
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function songFileContent(songs: Song[]): string {
  return JSON.stringify({ format: SONG_FORMAT, version: 1, songs: songs.map(toPortable) }, null, 2)
}

export function safeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled'
}

/** Write each song to its own file inside `dir`. Returns number written. */
export function writeSongsToDir(songs: Song[], dir: string, format: 'song' | 'txt'): number {
  for (const s of songs) {
    const file = join(dir, `${safeFileName(s.title)}.${format}`)
    writeFileSync(file, format === 'song' ? songFileContent([s]) : songToText(s), 'utf8')
  }
  return songs.length
}
