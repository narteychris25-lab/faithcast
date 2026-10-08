import type { SectionType, SongSection } from './types'

/**
 * Plain-text lyric format used by the song editor and TXT import:
 *
 *   [Verse 1]            ← section header (brackets optional: "Verse 1", "Chorus:")
 *   Amazing grace how sweet the sound
 *   That saved a wretch like me
 *                        ← blank line inside a section = forced slide break
 *   I once was lost...
 *
 * Text before the first header becomes "Verse 1" etc.
 */

const HEADER_WORDS: [RegExp, SectionType, string][] = [
  [/^(verse|v)$/i, 'verse', 'Verse'],
  [/^(chorus|c|refrain)$/i, 'chorus', 'Chorus'],
  [/^(pre[- ]?chorus|pc|pre)$/i, 'pre-chorus', 'Pre-Chorus'],
  [/^(bridge|b)$/i, 'bridge', 'Bridge'],
  [/^(tag)$/i, 'tag', 'Tag'],
  [/^(intro)$/i, 'intro', 'Intro'],
  [/^(ending|end|outro|coda)$/i, 'ending', 'Ending'],
  [/^(other|interlude|instrumental|vamp)$/i, 'other', 'Other']
]

export function parseHeader(line: string): { type: SectionType; label: string } | null {
  const trimmed = line.trim()
  const bracketed = /^[[(](.+)[\])]$/.exec(trimmed)
  const inner = (bracketed ? bracketed[1] : trimmed).replace(/:$/, '').trim()
  const m = /^([a-z][a-z -]*?)(?:\s*(\d+)([a-z])?)?$/i.exec(inner)
  if (!m) return null
  // Unbracketed lines must look exactly like a header, to avoid treating a lyric like "Bridge over water" as one.
  const word = m[1].trim()
  for (const [re, type, label] of HEADER_WORDS) {
    if (re.test(word)) {
      if (!bracketed && word.length <= 2 && !m[2]) return null // bare "C" / "V" lines are too ambiguous
      const num = m[2] ? ` ${m[2]}` : ''
      return { type, label: `${label}${num}${m[3] ? m[3].toLowerCase() : ''}` }
    }
  }
  return null
}

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function parseLyrics(text: string): SongSection[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const sections: SongSection[] = []
  let current: SongSection | null = null
  let autoVerse = 0

  const push = () => {
    if (current) {
      current.text = current.text.replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')
      if (current.text.trim()) sections.push(current)
    }
  }

  for (const raw of lines) {
    const header = parseHeader(raw)
    if (header) {
      push()
      current = { id: newId(), type: header.type, label: header.label, text: '' }
      continue
    }
    if (!current) {
      if (!raw.trim()) continue
      autoVerse += 1
      current = { id: newId(), type: 'verse', label: `Verse ${autoVerse}`, text: '' }
    }
    current.text += (current.text ? '\n' : '') + raw.trimEnd()
  }
  push()

  // Without explicit headers, split paragraphs (blank-line separated) into verses.
  if (sections.length === 1 && !lines.some((l) => parseHeader(l))) {
    const paragraphs = sections[0].text.split(/\n\s*\n/).filter((p) => p.trim())
    if (paragraphs.length > 1) {
      return paragraphs.map((p, i) => ({ id: newId(), type: 'verse', label: `Verse ${i + 1}`, text: p.trim() }))
    }
  }
  return sections
}

export function serializeLyrics(sections: SongSection[]): string {
  return sections.map((s) => `[${s.label}]\n${s.text.trim()}`).join('\n\n')
}

/** Resolve an arrangement (list of section ids) to sections, falling back to natural order. */
export function arrangedSections(sections: SongSection[], arrangement: string[] | undefined): SongSection[] {
  if (!arrangement || arrangement.length === 0) return sections
  const byId = new Map(sections.map((s) => [s.id, s]))
  const out = arrangement.map((id) => byId.get(id)).filter((s): s is SongSection => !!s)
  return out.length ? out : sections
}

/** Split a section into slide texts: honour blank-line breaks, then wrap at maxLines. */
export function sectionSlides(text: string, maxLines: number): string[] {
  const chunks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((c) => c.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((c) => c.length > 0)
  const out: string[] = []
  const max = Math.max(1, maxLines)
  for (const chunk of chunks) {
    if (chunk.length <= max) {
      out.push(chunk.join('\n'))
      continue
    }
    // Balance pages: 6 lines at max 4 → 3 + 3 rather than 4 + 2.
    const pages = Math.ceil(chunk.length / max)
    const per = Math.ceil(chunk.length / pages)
    for (let i = 0; i < chunk.length; i += per) out.push(chunk.slice(i, i + per).join('\n'))
  }
  return out
}

export function sectionAbbrev(label: string): string {
  const m = /^(\S+)(?:\s+(\S+))?/.exec(label)
  if (!m) return label
  const map: Record<string, string> = { verse: 'V', chorus: 'C', 'pre-chorus': 'PC', bridge: 'B', tag: 'T', intro: 'I', ending: 'E', other: 'O' }
  const base = map[m[1].toLowerCase()] ?? m[1].slice(0, 2)
  return base + (m[2] ?? '')
}
