// Builds the optional Bible library bundled with WorshipFlow from the
// thiagobodruk/bible repository (JSON files). Only versions marked
// public-domain or openly licensed AND "bundled" in src/shared/bible-catalog.json
// are converted — copyrighted versions are never bundled. English only.
// KJV and BSB (installed on first launch from resources/bibles) are listed too,
// so they can be reinstalled from the Bibles page after being removed.
//
// Usage: node scripts/build-bible-library.mjs <dir-with-json-files>
// Output: resources/bibles/library/<ABBR>.wfbible.json.gz + catalog.json
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) {
  console.error('usage: build-bible-library.mjs <dir with thiagobodruk json files>')
  process.exit(1)
}
const root = fileURLToPath(new URL('..', import.meta.url))
const catalog = JSON.parse(readFileSync(join(root, 'src/shared/bible-catalog.json'), 'utf8'))
const outDir = join(root, 'resources/bibles/library')
mkdirSync(outDir, { recursive: true })

// Book codes used by the repository (Portuguese), in canonical order.
const CODES = 'gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jó sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo atos rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap'.split(' ')

function clean(text) {
  const t = String(text ?? '')
    .replace(/\[[’'"“”]+\]/g, '') // stray quote artifacts, e.g. "[’’]"
    .replace(/\s+/g, ' ')
    .trim()
  return t === '[]' ? '' : t
}

const countVerses = (books) => books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.filter(Boolean).length, 0), 0)

const manifest = []
for (const [abbreviation, status] of [['KJV', 'public-domain'], ['BSB', 'public-domain']]) {
  const file = `${abbreviation}.wfbible.json.gz`
  const d = JSON.parse(gunzipSync(readFileSync(join(root, 'resources/bibles', file))).toString('utf8'))
  manifest.push({ code: abbreviation.toLowerCase(), abbreviation, name: d.name, language: 'English', license: d.license, status, file, verses: countVerses(d.books), books: d.books.length, core: true })
}
for (const entry of catalog.filter((e) => e.bundled && e.language === 'English')) {
  if (entry.status !== 'public-domain' && entry.status !== 'open') throw new Error(`refusing to bundle ${entry.code} (${entry.status})`)
  const file = join(src, `${entry.code}.json`)
  if (!existsSync(file)) {
    console.warn('missing', file)
    continue
  }
  const books = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))
  const out = books.map((b, i) => {
    // All 66 present → canonical position; otherwise identify the book by its code.
    const number = books.length === 66 ? i + 1 : CODES.indexOf(String(b.abbrev).toLowerCase()) + 1
    if (number < 1) throw new Error(`${entry.code}: unknown book code ${b.abbrev}`)
    return { number, chapters: b.chapters.map((c) => c.map(clean)) }
  })
  const verses = countVerses(out)
  const data = { format: 'worshipflow-bible', version: 1, abbreviation: entry.abbreviation, name: entry.name, language: entry.langCode, license: entry.license, books: out }
  const name = `${entry.abbreviation}.wfbible.json.gz`
  writeFileSync(join(outDir, name), gzipSync(JSON.stringify(data), { level: 9 }))
  manifest.push({ code: entry.code, abbreviation: entry.abbreviation, name: entry.name, language: entry.language, license: entry.license, status: entry.status, file: name, verses, books: out.length })
  console.log(entry.abbreviation.padEnd(8), String(verses).padStart(6), 'verses', entry.name)
}
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(manifest, null, 1) + '\n')
console.log(`wrote ${manifest.length} versions to resources/bibles/library`)
