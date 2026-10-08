import { readFileSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { findBook } from '@shared/bible-books'
import type { WfBibleFile } from '../db/repos/bible'
import { parse, WfBibleSchema } from '../validation'
import catalog from '@shared/bible-catalog.json'

export interface CatalogEntry {
  code: string
  abbreviation: string
  name: string
  language: string
  langCode: string
  status: 'public-domain' | 'open' | 'copyrighted' | 'unverified'
  license: string
  bundled: boolean
}

/** Versions known from the thiagobodruk/bible repository (names, languages, copyright status). */
export const BIBLE_CATALOG = catalog as CatalogEntry[]

/** Book codes used by thiagobodruk/bible (Portuguese), in canonical order. */
const TB_CODES = 'gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jó sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo atos rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap'.split(' ')

export interface BibleFileResult {
  bible: WfBibleFile
  /** Catalogue entry when the file is a recognised thiagobodruk/bible version. */
  entry?: CatalogEntry
}

const MAX_FILE = 80 * 1024 * 1024

/**
 * Reads a Bible the user is licensed to use. Supported formats:
 *  - .wfbible / .json (optionally gzipped) — WorshipFlow format (see DATABASE.md)
 *  - .json / .xml from github.com/thiagobodruk/bible (e.g. en_asv.json, en_asv.xml)
 *  - .xml — Zefania XML (<XMLBIBLE><BIBLEBOOK bnumber><CHAPTER cnumber><VERS vnumber>)
 *  - .csv — rows of: book,chapter,verse,text (book as number 1–66 or name)
 */
export function readBibleFileDetailed(file: string): BibleFileResult {
  const code = basename(file).replace(/\.(json|xml)(\.gz)?$/i, '')
  const entry = BIBLE_CATALOG.find((e) => e.code === code)
  const text = readText(file)
  const trimmed = text.trimStart()
  let bible: WfBibleFile
  if (trimmed.startsWith('[')) bible = parseThiagoJson(JSON.parse(text), file, entry)
  else if (trimmed.startsWith('<') && /<bible[\s>]/i.test(text.slice(0, 2000)) && !/<XMLBIBLE/i.test(text.slice(0, 2000))) bible = parseThiagoXml(text, file, entry)
  else return { bible: readBibleFile(file) }
  return { bible: validate(bible), entry }
}

function readText(file: string): string {
  if (statSync(file).size > MAX_FILE) throw new Error('File is too large')
  let buf = readFileSync(file)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
  return buf.toString('utf8').replace(/^\uFEFF/, '')
}

function validate(result: WfBibleFile): WfBibleFile {
  const valid = parse(WfBibleSchema, result, 'Bible file') as WfBibleFile
  const verses = valid.books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.filter(Boolean).length, 0), 0)
  if (verses < 1) throw new Error('No verses found')
  return valid
}

function cleanVerse(text: unknown): string {
  const t = String(text ?? '').replace(/\[[’'"“”]+\]/g, '').replace(/\s+/g, ' ').trim()
  return t === '[]' ? '' : t
}

function tbMeta(file: string, entry?: CatalogEntry) {
  const base = basename(file).replace(/\.(json|xml)(\.gz)?$/i, '')
  return {
    abbreviation: entry?.abbreviation ?? (base.split('_').slice(1).join('_') || base).toUpperCase().replace(/[^\w-]/g, '-').slice(0, 12),
    name: entry?.name ?? base,
    language: entry?.langCode ?? (base.includes('_') ? base.split('_')[0] : 'en'),
    license: entry?.license ?? ''
  }
}

/** thiagobodruk/bible JSON: [{ abbrev, name, chapters: string[][] }, …] */
function parseThiagoJson(data: unknown, file: string, entry?: CatalogEntry): WfBibleFile {
  if (!Array.isArray(data) || !data.every((b) => b && Array.isArray(b.chapters))) throw new Error('Unrecognised Bible JSON')
  const books = data.map((b: { abbrev?: string; chapters: unknown[][] }, i: number) => {
    // All 66 present → canonical order; otherwise identify each book by its code.
    const number = data.length === 66 ? i + 1 : TB_CODES.indexOf(String(b.abbrev ?? '').toLowerCase()) + 1 || findBook(String(b.abbrev ?? '')) || 0
    if (!number) throw new Error(`Unknown book code "${b.abbrev}"`)
    return { number, chapters: b.chapters.map((c) => (Array.isArray(c) ? c.map(cleanVerse) : [])) }
  })
  return { format: 'worshipflow-bible', version: 1, ...tbMeta(file, entry), books }
}

/** thiagobodruk/bible XML: <bible><b id="gn" n="…"><c n="1"><v n="1">text</v>… */
function parseThiagoXml(xml: string, file: string, entry?: CatalogEntry): WfBibleFile {
  const bookBlocks = [...xml.matchAll(/<b\b([^>]*)>([\s\S]*?)<\/b>/gi)]
  if (!bookBlocks.length) throw new Error('Unrecognised Bible XML')
  const books = new Map<number, string[][]>()
  bookBlocks.forEach((m, i) => {
    const id = /\bid="([^"]+)"/i.exec(m[1])?.[1] ?? ''
    const number = bookBlocks.length === 66 ? i + 1 : TB_CODES.indexOf(id.toLowerCase()) + 1 || findBook(id) || 0
    if (!number) throw new Error(`Unknown book code "${id}"`)
    for (const c of m[2].matchAll(/<c\b[^>]*\bn="(\d+)"[^>]*>([\s\S]*?)<\/c>/gi)) {
      for (const v of c[2].matchAll(/<v\b[^>]*\bn="(\d+)"[^>]*>([\s\S]*?)<\/v>/gi)) {
        put(books, number, Number(c[1]), Number(v[1]), cleanVerse(unescape(v[2])))
      }
    }
  })
  return finish(books, tbMeta(file, entry).name, tbMeta(file, entry).abbreviation, tbMeta(file, entry).language, tbMeta(file, entry).license)
}

export function readBibleFile(file: string): WfBibleFile {
  if (statSync(file).size > MAX_FILE) throw new Error('File is too large')
  let buf = readFileSync(file)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
  const text = buf.toString('utf8').replace(/^﻿/, '')
  const ext = extname(file.replace(/\.gz$/i, '')).toLowerCase()
  const fallbackName = basename(file).replace(/\.(wfbible|json|xml|csv)(\.gz)?$/i, '')

  let result: WfBibleFile
  if (ext === '.xml' || text.trimStart().startsWith('<')) result = parseZefania(text, fallbackName)
  else if (ext === '.csv') result = parseCsv(text, fallbackName)
  else result = JSON.parse(text) as WfBibleFile
  const valid = parse(WfBibleSchema, result, 'Bible file') as WfBibleFile
  const verses = valid.books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0)
  if (verses < 1) throw new Error('No verses found')
  return valid
}

function abbrevFrom(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const a = letters.length > 1 ? letters.map((w) => w[0]).join('') : (letters[0] ?? 'BIBLE').slice(0, 6)
  return a.toUpperCase().slice(0, 12) || 'BIBLE'
}

function put(books: Map<number, string[][]>, book: number, chapter: number, verse: number, text: string): void {
  if (book < 1 || book > 66 || chapter < 1 || verse < 1 || chapter > 200 || verse > 200) return
  const chapters = books.get(book) ?? []
  const verses = (chapters[chapter - 1] ??= [])
  verses[verse - 1] = text.replace(/\s+/g, ' ').trim()
  books.set(book, chapters)
}

function finish(books: Map<number, string[][]>, name: string, abbreviation: string, language = 'en', license = ''): WfBibleFile {
  return {
    format: 'worshipflow-bible',
    version: 1,
    abbreviation,
    name,
    language,
    license,
    books: [...books.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, chapters]) => ({
        number,
        chapters: Array.from(chapters, (c) => Array.from(c ?? [], (v) => v ?? ''))
      }))
  }
}

const unescape = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

export function parseZefania(xml: string, fallbackName: string): WfBibleFile {
  if (!/<XMLBIBLE/i.test(xml)) throw new Error('Unrecognised XML Bible format (expected Zefania XML)')
  const name = unescape(/<title>([\s\S]*?)<\/title>/i.exec(xml)?.[1] ?? /biblename="([^"]+)"/i.exec(xml)?.[1] ?? fallbackName).trim()
  const ident = unescape(/<identifier>([\s\S]*?)<\/identifier>/i.exec(xml)?.[1] ?? '').trim()
  const rights = unescape(/<rights>([\s\S]*?)<\/rights>/i.exec(xml)?.[1] ?? '').trim()
  const lang = unescape(/<language>([\s\S]*?)<\/language>/i.exec(xml)?.[1] ?? 'en').trim()
  const books = new Map<number, string[][]>()
  for (const b of xml.matchAll(/<BIBLEBOOK\b([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/gi)) {
    const bnum = Number(/bnumber="(\d+)"/i.exec(b[1])?.[1])
    for (const c of b[2].matchAll(/<CHAPTER\b([^>]*)>([\s\S]*?)<\/CHAPTER>/gi)) {
      const cnum = Number(/cnumber="(\d+)"/i.exec(c[1])?.[1])
      for (const v of c[2].matchAll(/<VERS\b([^>]*)>([\s\S]*?)<\/VERS>/gi)) {
        put(books, bnum, cnum, Number(/vnumber="(\d+)"/i.exec(v[1])?.[1]), unescape(v[2]))
      }
    }
  }
  return finish(books, name || fallbackName, (ident || abbrevFrom(name)).replace(/[^\w-]/g, '').slice(0, 12), lang.slice(0, 20), rights)
}

function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function parseCsv(text: string, fallbackName: string): WfBibleFile {
  const books = new Map<number, string[][]>()
  for (const r of csvRows(text)) {
    if (r.length < 4) continue
    const book = /^\d+$/.test(r[0].trim()) ? Number(r[0]) : findBook(r[0])
    const chapter = Number(r[1])
    const verse = Number(r[2])
    if (!book || !chapter || !verse) continue // header row / junk
    put(books, book, chapter, verse, r.slice(3).join(','))
  }
  return finish(books, fallbackName, abbrevFrom(fallbackName))
}
