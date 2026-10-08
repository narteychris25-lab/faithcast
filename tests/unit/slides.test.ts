import { describe, it, expect } from 'vitest'
import { buildSlides, backgroundKey, type SlideContext } from '../../src/shared/slides'
import { BUILTIN_THEMES, DEFAULT_CHURCH, DEFAULT_SETTINGS, DEFAULT_BACKGROUND } from '../../src/shared/defaults'
import { parseLyrics } from '../../src/shared/lyrics'
import type { ServiceItem, Song, Theme } from '../../src/shared/types'

const themes = new Map<string, Theme>(
  BUILTIN_THEMES.map((t) => [t.id, { ...t, builtin: true, createdAt: '', updatedAt: '' }])
)
const ctx = (extra: Partial<SlideContext> = {}): SlideContext => ({
  service: { themeId: 'theme-classic', background: null },
  themes,
  settings: DEFAULT_SETTINGS,
  church: { ...DEFAULT_CHURCH, logoMediaId: 'logo1' },
  ...extra
})
const item = (p: Partial<ServiceItem>): ServiceItem => ({
  id: 'i1',
  serviceId: 's1',
  position: 0,
  type: 'song',
  title: 't',
  refId: null,
  data: {},
  themeId: null,
  background: null,
  transition: null,
  hidden: false,
  locked: false,
  notes: '',
  createdAt: '',
  updatedAt: '',
  ...p
})

describe('buildSlides', () => {
  const sections = parseLyrics('[Verse 1]\n1\n2\n3\n4\n5\n6\n[Chorus]\nGlory one\nGlory two')
  const song: Song = {
    id: 'song1', title: 'Test Song', author: 'A', copyright: 'PD', ccli: '123', category: '', tags: [], notes: '',
    sections, arrangement: [sections[0].id, sections[1].id, sections[1].id], themeId: null, demo: false, createdAt: '', updatedAt: ''
  }

  it('builds song slides using arrangement, maxLines and copyright footer', () => {
    const slides = buildSlides(item({ type: 'song', refId: 'song1' }), ctx({ song }))
    expect(slides.map((s) => s.label)).toEqual(['Verse 1 (1/2)', 'Verse 1 (2/2)', 'Chorus', 'Chorus'])
    expect(slides[0].text).toBe('1\n2\n3')
    expect(slides[0].subtext).toContain('CCLI Song #123')
    expect(slides[1].subtext).toBe('')
    expect(new Set(slides.map((s) => s.key)).size).toBe(4)
    expect(slides[0].theme.text.fontFamily).toBe('Georgia') // service theme = classic
  })

  it('item theme overrides service theme; item background overrides theme background', () => {
    const bg = { ...DEFAULT_BACKGROUND, kind: 'color' as const, color: '#ff0000' }
    const slides = buildSlides(item({ type: 'song', themeId: 'theme-youth', background: bg }), ctx({ song }))
    expect(slides[0].theme.text.fontFamily).toBe('Futura')
    expect(slides[0].background.color).toBe('#ff0000')
  })

  it('builds bible slides with verses per slide and references', () => {
    const verses = [16, 17, 18].map((v) => ({ book: 43, chapter: 3, verse: v, text: `verse ${v}` }))
    const one = buildSlides(
      item({ type: 'bible', data: { bible: { translationId: 't', book: 43, chapter: 3, verseStart: 16, verseEnd: 18, versesPerSlide: 1 } } }),
      ctx({ verses, translationAbbrev: 'KJV' })
    )
    expect(one.map((s) => s.subtext)).toEqual(['John 3:16 (KJV)', 'John 3:17 (KJV)', 'John 3:18 (KJV)'])
    expect(one[0].text).toBe('verse 16')
    const two = buildSlides(
      item({ type: 'bible', data: { bible: { translationId: 't', book: 43, chapter: 3, verseStart: 16, verseEnd: 18, versesPerSlide: 2 } } }),
      ctx({ verses })
    )
    expect(two).toHaveLength(2)
    expect(two[0].text).toBe('¹⁶verse 16 ¹⁷verse 17')
    expect(two[0].label).toBe('John 3:16-17')
  })

  it('media, audio, header and body items', () => {
    const img = buildSlides(item({ type: 'image', data: { mediaId: 'm1' } }), ctx())
    expect(img[0].kind).toBe('media')
    expect(img[0].media?.mediaId).toBe('m1')
    expect(buildSlides(item({ type: 'audio', data: { mediaId: 'a1' } }), ctx())).toEqual([])
    expect(buildSlides(item({ type: 'header' }), ctx())).toEqual([])
    const sermon = buildSlides(item({ type: 'sermon', title: 'Sermon', data: { body: 'Point one\n\nPoint two' } }), ctx())
    expect(sermon.map((s) => s.text)).toEqual(['Point one', 'Point two'])
    expect(buildSlides(item({ type: 'prayer', title: 'Prayer' }), ctx())[0].text).toBe('Prayer')
  })

  it('web items: YouTube becomes the embed player', () => {
    const s = buildSlides(item({ type: 'web', title: 'Clip', data: { web: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Clip' } } }), ctx())[0]
    expect(s.kind).toBe('web')
    expect(s.web?.url).toContain('youtube.com/embed/dQw4w9WgXcQ')
    expect(buildSlides(item({ type: 'web', title: 'X', data: { web: { url: 'https://example.com', title: 'X' } } }), ctx())[0].web?.url).toBe('https://example.com')
  })

  it('announcement uses image as dimmed background', () => {
    const s = buildSlides(
      item({ type: 'announcement', data: { announcement: { title: 'YOUTH', description: 'd', date: 'Friday', time: '6:00 PM', location: 'Hall', imageMediaId: 'img' } } }),
      ctx()
    )[0]
    expect(s.kind).toBe('announcement')
    expect(s.subtext).toBe('Friday  •  6:00 PM  •  Hall')
    expect(s.background.kind).toBe('image')
    expect(s.background.dim).toBeGreaterThanOrEqual(0.45)
  })

  it('background key is stable for identical backgrounds', () => {
    expect(backgroundKey({ ...DEFAULT_BACKGROUND })).toBe(backgroundKey({ ...DEFAULT_BACKGROUND }))
    expect(backgroundKey({ ...DEFAULT_BACKGROUND, kind: 'video', mediaId: 'a' })).not.toBe(
      backgroundKey({ ...DEFAULT_BACKGROUND, kind: 'video', mediaId: 'b' })
    )
  })
})
