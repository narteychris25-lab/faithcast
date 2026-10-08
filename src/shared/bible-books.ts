/** Protestant 66-book canon in canonical order. Book numbers are 1-based. */
export interface BibleBookInfo {
  number: number
  name: string
  abbrev: string
  testament: 'OT' | 'NT'
  aliases: string[]
}

const RAW: [string, string, string[]][] = [
  ['Genesis', 'Gen', ['ge', 'gn']],
  ['Exodus', 'Exod', ['ex', 'exo']],
  ['Leviticus', 'Lev', ['le', 'lv']],
  ['Numbers', 'Num', ['nu', 'nm', 'nb']],
  ['Deuteronomy', 'Deut', ['dt', 'deu']],
  ['Joshua', 'Josh', ['jos', 'jsh']],
  ['Judges', 'Judg', ['jdg', 'jg', 'jdgs']],
  ['Ruth', 'Ruth', ['rth', 'ru']],
  ['1 Samuel', '1 Sam', ['1sa', '1sm', 'i samuel', '1st samuel', 'first samuel']],
  ['2 Samuel', '2 Sam', ['2sa', '2sm', 'ii samuel', '2nd samuel', 'second samuel']],
  ['1 Kings', '1 Kgs', ['1ki', '1k', 'i kings', '1st kings']],
  ['2 Kings', '2 Kgs', ['2ki', '2k', 'ii kings', '2nd kings']],
  ['1 Chronicles', '1 Chr', ['1ch', 'i chronicles', '1chron']],
  ['2 Chronicles', '2 Chr', ['2ch', 'ii chronicles', '2chron']],
  ['Ezra', 'Ezra', ['ezr']],
  ['Nehemiah', 'Neh', ['ne']],
  ['Esther', 'Esth', ['est', 'es']],
  ['Job', 'Job', ['jb']],
  ['Psalms', 'Ps', ['psalm', 'psa', 'pss', 'psm']],
  ['Proverbs', 'Prov', ['pr', 'prv', 'pro']],
  ['Ecclesiastes', 'Eccl', ['ec', 'ecc', 'qoh']],
  ['Song of Solomon', 'Song', ['sos', 'song of songs', 'canticles', 'sng']],
  ['Isaiah', 'Isa', ['is']],
  ['Jeremiah', 'Jer', ['je', 'jr']],
  ['Lamentations', 'Lam', ['la']],
  ['Ezekiel', 'Ezek', ['eze', 'ezk']],
  ['Daniel', 'Dan', ['da', 'dn']],
  ['Hosea', 'Hos', ['ho']],
  ['Joel', 'Joel', ['jl']],
  ['Amos', 'Amos', ['am']],
  ['Obadiah', 'Obad', ['ob']],
  ['Jonah', 'Jonah', ['jnh', 'jon']],
  ['Micah', 'Mic', ['mc']],
  ['Nahum', 'Nah', ['na']],
  ['Habakkuk', 'Hab', ['hb']],
  ['Zephaniah', 'Zeph', ['zep', 'zp']],
  ['Haggai', 'Hag', ['hg']],
  ['Zechariah', 'Zech', ['zec', 'zc']],
  ['Malachi', 'Mal', ['ml']],
  ['Matthew', 'Matt', ['mt', 'mat']],
  ['Mark', 'Mark', ['mk', 'mrk', 'mr']],
  ['Luke', 'Luke', ['lk', 'luk']],
  ['John', 'John', ['jn', 'jhn', 'joh']],
  ['Acts', 'Acts', ['ac', 'act']],
  ['Romans', 'Rom', ['ro', 'rm']],
  ['1 Corinthians', '1 Cor', ['1co', 'i corinthians', '1st corinthians']],
  ['2 Corinthians', '2 Cor', ['2co', 'ii corinthians', '2nd corinthians']],
  ['Galatians', 'Gal', ['ga']],
  ['Ephesians', 'Eph', ['ephes']],
  ['Philippians', 'Phil', ['php', 'pp']],
  ['Colossians', 'Col', ['co']],
  ['1 Thessalonians', '1 Thess', ['1th', 'i thessalonians']],
  ['2 Thessalonians', '2 Thess', ['2th', 'ii thessalonians']],
  ['1 Timothy', '1 Tim', ['1ti', 'i timothy']],
  ['2 Timothy', '2 Tim', ['2ti', 'ii timothy']],
  ['Titus', 'Titus', ['tit']],
  ['Philemon', 'Phlm', ['phm', 'philem']],
  ['Hebrews', 'Heb', ['he']],
  ['James', 'Jas', ['jm', 'jam']],
  ['1 Peter', '1 Pet', ['1pe', '1pt', 'i peter']],
  ['2 Peter', '2 Pet', ['2pe', '2pt', 'ii peter']],
  ['1 John', '1 John', ['1jn', '1jo', 'i john']],
  ['2 John', '2 John', ['2jn', '2jo', 'ii john']],
  ['3 John', '3 John', ['3jn', '3jo', 'iii john']],
  ['Jude', 'Jude', ['jud']],
  ['Revelation', 'Rev', ['re', 'rv', 'revelations', 'apocalypse']]
]

export const BIBLE_BOOKS: BibleBookInfo[] = RAW.map(([name, abbrev, aliases], i) => ({
  number: i + 1,
  name,
  abbrev,
  testament: i < 39 ? 'OT' : 'NT',
  aliases
}))

export function bookName(n: number): string {
  return BIBLE_BOOKS[n - 1]?.name ?? `Book ${n}`
}

const norm = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()

/** Resolve a user-typed book name ("jn", "1 cor", "Psalm") to a book number. */
export function findBook(input: string): number | null {
  const q = norm(input)
  if (!q) return null
  const compact = q.replace(/ /g, '')
  for (const b of BIBLE_BOOKS) {
    const names = [b.name, b.abbrev, ...b.aliases].map(norm)
    if (names.includes(q) || names.map((n) => n.replace(/ /g, '')).includes(compact)) return b.number
  }
  // Prefix match on full name ("rev" → Revelation, "phili" → Philippians)
  const prefix = BIBLE_BOOKS.filter((b) => norm(b.name).replace(/ /g, '').startsWith(compact))
  return prefix.length >= 1 ? prefix[0].number : null
}

const compactOf = (s: string) => norm(s).replace(/ /g, '')

/**
 * Book suggestions for a partly-typed book name, best first (EasyWorship-style
 * scripture entry). Returns [] once the user is past the book name, e.g.
 * "John " or "John 3".
 *
 * Ranking: exact abbreviation/alias ("jn", "ps", "1cor"), then books whose
 * name starts with the typed letters, in canonical order.
 */
export function matchBooks(input: string, available?: Set<number>): BibleBookInfo[] {
  const raw = input.replace(/^\s+/, '')
  if (!raw) return []
  // Book phase only: optional leading 1–3, then letters/spaces/dots — no chapter digits yet.
  if (!/^([1-3]\s*)?[a-z .]*$/i.test(raw)) return []
  const typed = compactOf(raw)
  if (!typed) return []
  // A complete book name followed by a space means the user has moved on to the chapter.
  if (/\s$/.test(raw) && BIBLE_BOOKS.some((b) => compactOf(b.name) === typed)) return []
  const pool = available ? BIBLE_BOOKS.filter((b) => available.has(b.number)) : BIBLE_BOOKS
  const exact = pool.filter((b) => [b.abbrev, ...b.aliases].some((a) => compactOf(a) === typed))
  const prefix = pool.filter((b) => compactOf(b.name).startsWith(typed))
  return [...new Set([...prefix.filter((b) => compactOf(b.name) === typed), ...exact, ...prefix])]
}

/**
 * If `typed` is a letter-for-letter prefix of the book name (ignoring case
 * and spaces), returns how many characters of the name it covers, so the rest
 * can be shown as an inline completion. Otherwise returns -1.
 */
export function completionStart(typed: string, bookName: string): number {
  const t = compactOf(typed)
  let i = 0
  let k = 0
  while (i < bookName.length && k < t.length) {
    const ch = bookName[i].toLowerCase()
    if (ch === ' ') {
      i++
      continue
    }
    if (ch !== t[k]) return -1
    i++
    k++
  }
  if (k !== t.length) return -1
  // "1 " has already typed the space: the completion starts after it.
  if (/\s$/.test(typed)) while (bookName[i] === ' ') i++
  return i
}

export interface ParsedReference {
  book: number
  chapter: number
  verseStart: number | null
  verseEnd: number | null
}

/**
 * Parse references like "John 3:16", "jn 3:16-18", "1 Cor 13", "Ps 23:1–6".
 * Returns null when the input does not look like a reference.
 */
export function parseReference(input: string): ParsedReference | null {
  const m = input
    .trim()
    .replace(/[–—]/g, '-')
    .match(/^((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?)?$/i)
  if (!m) return null
  const book = findBook(m[1])
  if (!book) return null
  const chapter = Number(m[2])
  const verseStart = m[3] ? Number(m[3]) : null
  const verseEnd = m[4] ? Number(m[4]) : verseStart
  if (verseStart !== null && verseEnd !== null && verseEnd < verseStart) return null
  return { book, chapter, verseStart, verseEnd }
}

export function formatReference(book: number, chapter: number, vs: number, ve: number): string {
  const base = `${bookName(book)} ${chapter}:${vs}`
  return ve > vs ? `${base}-${ve}` : base
}
