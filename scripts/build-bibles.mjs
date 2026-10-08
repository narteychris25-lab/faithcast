// Converts scrollmapper-format Bible JSON (public-domain translations only) into
// FaithCast's compact bundled format: resources/bibles/<ABBR>.fcbible.json.gz
// Usage: node scripts/build-bibles.mjs <input.json> <ABBR> "<Full name>" "<license note>"
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const [input, abbreviation, name, license] = process.argv.slice(2)
if (!input || !abbreviation || !name) {
  console.error('usage: build-bibles.mjs <input.json> <ABBR> "<name>" "<license>"')
  process.exit(1)
}
const src = JSON.parse(readFileSync(input, 'utf8'))
if (!Array.isArray(src.books) || src.books.length !== 66) throw new Error('expected 66 books')

const out = {
  format: 'faithcast-bible',
  version: 1,
  abbreviation,
  name,
  language: 'en',
  license: license || 'Public domain',
  books: src.books.map((b, i) => ({
    number: i + 1,
    chapters: b.chapters.map((c) => c.verses.map((v) => String(v.text).replace(/\s+/g, ' ').trim()))
  }))
}
const file = new URL(`../resources/bibles/${abbreviation}.fcbible.json.gz`, import.meta.url)
writeFileSync(file, gzipSync(JSON.stringify(out), { level: 9 }))
console.log('wrote', file.pathname)
