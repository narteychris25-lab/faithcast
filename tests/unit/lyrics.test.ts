import { describe, it, expect } from 'vitest'
import { parseLyrics, sectionSlides, serializeLyrics, parseHeader, arrangedSections } from '../../src/shared/lyrics'
import { completionStart, findBook, matchBooks, parseReference } from '../../src/shared/bible-books'
import { deepMerge, DEFAULT_SETTINGS, mergeSettings } from '../../src/shared/defaults'

describe('lyrics parser', () => {
  it('parses bracketed and plain headers', () => {
    const s = parseLyrics('[Verse 1]\nLine a\nLine b\n\nChorus\nLine c\n\nBridge:\nLine d\n(Verse 2)\nLine e')
    expect(s.map((x) => [x.type, x.label])).toEqual([
      ['verse', 'Verse 1'],
      ['chorus', 'Chorus'],
      ['bridge', 'Bridge'],
      ['verse', 'Verse 2']
    ])
    expect(s[0].text).toBe('Line a\nLine b')
  })

  it('does not treat lyric lines as headers', () => {
    expect(parseHeader('Bridge over troubled water')).toBeNull()
    expect(parseHeader('C')).toBeNull()
    expect(parseHeader('[C]')).toEqual({ type: 'chorus', label: 'Chorus' })
    expect(parseHeader('Pre-Chorus 2')).toEqual({ type: 'pre-chorus', label: 'Pre-Chorus 2' })
  })

  it('splits header-less paragraphs into verses', () => {
    const s = parseLyrics('one\ntwo\n\nthree\nfour')
    expect(s.map((x) => x.label)).toEqual(['Verse 1', 'Verse 2'])
  })

  it('round-trips through serialize', () => {
    const s = parseLyrics('[Verse 1]\nA\nB\n\n[Chorus]\nC')
    const again = parseLyrics(serializeLyrics(s))
    expect(again.map((x) => [x.label, x.text])).toEqual(s.map((x) => [x.label, x.text]))
  })

  it('splits sections into balanced slides', () => {
    expect(sectionSlides('1\n2\n3\n4\n5\n6', 4)).toEqual(['1\n2\n3', '4\n5\n6'])
    expect(sectionSlides('1\n2\n\n3', 4)).toEqual(['1\n2', '3'])
    expect(sectionSlides('1\n2\n3', 4)).toEqual(['1\n2\n3'])
  })

  it('applies arrangements', () => {
    const s = parseLyrics('[Verse 1]\nA\n[Chorus]\nB')
    expect(arrangedSections(s, [s[1].id, s[0].id, s[1].id]).map((x) => x.label)).toEqual(['Chorus', 'Verse 1', 'Chorus'])
    expect(arrangedSections(s, ['missing']).length).toBe(2)
  })
})

describe('bible references', () => {
  it('resolves book names and abbreviations', () => {
    expect(findBook('John')).toBe(43)
    expect(findBook('jn')).toBe(43)
    expect(findBook('1 Cor')).toBe(46)
    expect(findBook('1cor')).toBe(46)
    expect(findBook('Psalm')).toBe(19)
    expect(findBook('rev')).toBe(66)
    expect(findBook('Song of Songs')).toBe(22)
    expect(findBook('xyz')).toBeNull()
  })
  it('parses references', () => {
    expect(parseReference('John 3:16')).toEqual({ book: 43, chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(parseReference('jn 3:16-18')).toEqual({ book: 43, chapter: 3, verseStart: 16, verseEnd: 18 })
    expect(parseReference('1 Cor 13')).toEqual({ book: 46, chapter: 13, verseStart: null, verseEnd: null })
    expect(parseReference('Ps 23:1–6')).toEqual({ book: 19, chapter: 23, verseStart: 1, verseEnd: 6 })
    expect(parseReference('amazing grace')).toBeNull()
    expect(parseReference('John 3:18-16')).toBeNull()
  })
})

describe('settings merge', () => {
  it('fills new defaults and rejects wrong types', () => {
    const s = mergeSettings({ uiScale: 'big', presentation: { aspectRatio: '4:3' } })
    expect(s.uiScale).toBe(1)
    expect(s.presentation.aspectRatio).toBe('4:3')
    expect(s.presentation.defaultTransition).toEqual(DEFAULT_SETTINGS.presentation.defaultTransition)
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] })
    expect(deepMerge({ id: 5 as number | null, o: { x: 1 } }, { id: null, o: null })).toEqual({ id: null, o: { x: 1 } })
  })
})

describe('book autocomplete (EasyWorship-style)', () => {
  const names = (s: string, avail?: Set<number>) => matchBooks(s, avail).map((b) => b.name)
  it('suggests books from the first letters, canonical order', () => {
    expect(names('jo').slice(0, 5)).toEqual(['Joshua', 'Job', 'Joel', 'Jonah', 'John'])
    expect(names('joh')[0]).toBe('John')
    expect(names('ge')[0]).toBe('Genesis')
    expect(names('re')[0]).toBe('Revelation')
    expect(names('ps')[0]).toBe('Psalms')
    expect(names('phi')).toEqual(['Philippians', 'Philemon'])
  })
  it('handles numbered books and abbreviations', () => {
    expect(names('1')[0]).toBe('1 Samuel')
    expect(names('1 co')[0]).toBe('1 Corinthians')
    expect(names('2ti')[0]).toBe('2 Timothy')
    expect(names('jn')[0]).toBe('John')
    expect(names('song')[0]).toBe('Song of Solomon')
  })
  it('stops suggesting once the chapter starts, and respects the installed books', () => {
    expect(names('John ')).toEqual([])
    expect(names('John 3')).toEqual([])
    expect(names('xyz')).toEqual([])
    expect(names('jo', new Set([43]))).toEqual(['John'])
  })
  it('computes inline completion positions', () => {
    expect(completionStart('jo', 'John')).toBe(2)
    expect(completionStart('1co', '1 Corinthians')).toBe(4)
    expect(completionStart('songof', 'Song of Solomon')).toBe(7)
    expect(completionStart('jn', 'John')).toBe(-1)
    expect(completionStart('1 ', '1 Samuel')).toBe(2)
  })
})

describe('internet helpers', async () => {
  const { youtubeId, outputUrl, toUrl, songTitleFromPage } = await import('../../src/shared/web')
  it('recognises YouTube links and builds the embed player URL', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk')
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(outputUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1&playsinline=1&start=90')
    expect(outputUrl('https://example.com/page')).toBe('https://example.com/page')
  })
  it('turns address-bar input into URLs or searches', () => {
    expect(toUrl('example.com')).toBe('https://example.com')
    expect(toUrl('https://a.org/x')).toBe('https://a.org/x')
    expect(toUrl('amazing grace lyrics')).toBe('https://www.google.com/search?q=amazing%20grace%20lyrics')
  })
  it('derives song titles from lyrics page titles', () => {
    expect(songTitleFromPage('Amazing Grace Lyrics - John Newton | Hymnary')).toBe('Amazing Grace')
    expect(songTitleFromPage('It Is Well With My Soul (Lyrics)')).toBe('It Is Well With My Soul')
  })
})
