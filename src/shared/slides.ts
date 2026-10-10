import type {
  AppSettings,
  Background,
  BibleVerse,
  Church,
  RenderSlide,
  Service,
  ServiceItem,
  Song,
  Theme,
  ThemeSettings
} from './types'
import { DEFAULT_BACKGROUND, DEFAULT_MEDIA_SETTINGS, DEFAULT_THEME_SETTINGS } from './defaults'
import { arrangedSections, sectionSlides } from './lyrics'
import { formatReference } from './bible-books'
import { outputUrl } from './web'

/** Everything needed to turn a service item into slides, fetched by the caller. */
export interface SlideContext {
  service: Pick<Service, 'themeId' | 'background'> | null
  themes: Map<string, Theme>
  settings: AppSettings
  church: Church
  song?: Song | null
  verses?: BibleVerse[]
  translationAbbrev?: string
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'
export const superscript = (n: number) => String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)])

/** The theme chosen with the top-bar Background button, if it is on and still exists. */
export function backgroundTheme(ctx: Pick<SlideContext, 'settings' | 'themes'>): Theme | null {
  const id = ctx.settings.presentation?.backgroundThemeId
  return (id && ctx.themes.get(id)) || null
}

export function resolveTheme(item: ServiceItem | null, ctx: SlideContext): ThemeSettings {
  const forced = backgroundTheme(ctx)
  if (forced) return forced.settings
  const ids = [item?.themeId, item?.type === 'song' ? ctx.song?.themeId : null, ctx.service?.themeId, ctx.settings.defaultThemeId]
  for (const id of ids) {
    if (id && ctx.themes.has(id)) return ctx.themes.get(id)!.settings
  }
  return ctx.themes.values().next().value?.settings ?? DEFAULT_THEME_SETTINGS
}

export function resolveBackground(item: ServiceItem | null, theme: ThemeSettings, ctx: SlideContext): Background {
  if (backgroundTheme(ctx)) return theme.background
  return item?.background ?? ctx.service?.background ?? theme.background ?? DEFAULT_BACKGROUND
}

/** Stable identity of a background, used to keep it (and its video) running across slides. */
export function backgroundKey(bg: Background): string {
  switch (bg.kind) {
    case 'image':
    case 'video':
      return `${bg.kind}:${bg.mediaId}:${bg.fit}:${bg.posX}:${bg.posY}:${bg.blur}:${bg.opacity}`
    case 'gradient':
      return `g:${bg.gradient.from}:${bg.gradient.to}:${bg.gradient.angle}`
    case 'color':
      return `c:${bg.color}`
    default:
      return 'none'
  }
}

function base(item: ServiceItem, theme: ThemeSettings, background: Background, ctx: SlideContext, idx: number): RenderSlide {
  return {
    key: `${item.id}:${idx}`,
    kind: 'text',
    label: '',
    group: '',
    text: '',
    subtext: '',
    title: '',
    theme,
    background,
    media: null,
    elements: [],
    logoMediaId: ctx.church.logoMediaId
  }
}

function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Build the ordered slide list for one service item. */
export function buildSlides(item: ServiceItem, ctx: SlideContext): RenderSlide[] {
  const theme = resolveTheme(item, ctx)
  const background = resolveBackground(item, theme, ctx)
  const mk = (i: number) => base(item, theme, background, ctx, i)

  switch (item.type) {
    case 'song': {
      const song = ctx.song
      if (!song) return [{ ...mk(0), label: 'Song unavailable', text: item.title }]
      const sections = arrangedSections(song.sections, item.data.arrangement?.length ? item.data.arrangement : song.arrangement)
      const maxLines = Math.min(theme.maxLines, ctx.settings.songs.maxLinesPerSlide) || 4
      const footer = [song.title, song.author, song.copyright ? `© ${song.copyright}` : '', song.ccli ? `CCLI Song #${song.ccli}` : '']
        .filter(Boolean)
        .join(' · ')
      const slides: RenderSlide[] = []
      sections.forEach((sec, si) => {
        const pages = sectionSlides(sec.text, maxLines)
        pages.forEach((text, pi) => {
          slides.push({
            ...mk(slides.length),
            key: `${item.id}:${si}:${pi}`,
            label: pages.length > 1 ? `${sec.label} (${pi + 1}/${pages.length})` : sec.label,
            group: sec.label,
            text
          })
        })
      })
      if (!slides.length) slides.push({ ...mk(0), label: 'Title', text: song.title })
      if (ctx.settings.songs.showCopyrightOnFirstSlide) slides[0].subtext = footer
      if (ctx.settings.songs.showCopyrightOnLastSlide) slides[slides.length - 1].subtext = footer
      return slides
    }

    case 'bible': {
      const ref = item.data.bible
      const verses = ctx.verses ?? []
      if (!ref || !verses.length) return [{ ...mk(0), label: 'Passage unavailable', text: item.title }]
      const per = ref.versesPerSlide > 0 ? ref.versesPerSlide : 0
      const groups: BibleVerse[][] = []
      if (per > 0) {
        for (let i = 0; i < verses.length; i += per) groups.push(verses.slice(i, i + per))
      } else {
        // Auto: pack verses up to ~320 characters per slide.
        let cur: BibleVerse[] = []
        let len = 0
        for (const v of verses) {
          if (cur.length && len + v.text.length > 320) {
            groups.push(cur)
            cur = []
            len = 0
          }
          cur.push(v)
          len += v.text.length
        }
        if (cur.length) groups.push(cur)
      }
      const abbr = ctx.translationAbbrev ? ` (${ctx.translationAbbrev})` : ''
      return groups.map((g, i) => {
        const first = g[0].verse
        const last = g[g.length - 1].verse
        const text = g.length === 1 ? g[0].text : g.map((v) => `${superscript(v.verse)}${v.text}`).join(' ')
        return {
          ...mk(i),
          label: formatReference(ref.book, ref.chapter, first, last),
          group: formatReference(ref.book, ref.chapter, ref.verseStart, ref.verseEnd),
          text,
          subtext: ctx.settings.bible.showReference ? `${formatReference(ref.book, ref.chapter, first, last)}${abbr}` : ''
        }
      })
    }

    case 'image':
    case 'video': {
      const mediaId = item.data.mediaId
      if (!mediaId) return [{ ...mk(0), label: 'No media selected', text: '' }]
      return [
        {
          ...mk(0),
          kind: 'media',
          label: item.title,
          group: item.type === 'image' ? 'Image' : 'Video',
          background: { ...DEFAULT_BACKGROUND, kind: 'color', color: '#000000' },
          media: { mediaId, type: item.type, settings: { ...DEFAULT_MEDIA_SETTINGS, ...item.data.media } }
        }
      ]
    }

    case 'audio':
      // Audio does not change the picture; the operator UI handles playback.
      return []

    case 'announcement': {
      const a = item.data.announcement
      if (!a) return [{ ...mk(0), label: item.title, text: item.title }]
      const bg: Background = a.imageMediaId && !item.background
        ? { ...background, kind: 'image', mediaId: a.imageMediaId, fit: 'cover', dim: Math.max(background.dim, 0.45) }
        : background
      return [
        {
          ...mk(0),
          kind: 'announcement',
          label: a.title || item.title,
          group: 'Announcement',
          title: a.title || item.title,
          text: a.description,
          subtext: [a.date, a.time, a.location].filter(Boolean).join('  •  '),
          background: bg
        }
      ]
    }

    case 'custom': {
      const slides = item.data.slides ?? []
      if (!slides.length) return [{ ...mk(0), label: 'Empty slide', text: '' }]
      return slides.map((s, i) => ({
        ...mk(i),
        key: `${item.id}:${s.id}`,
        kind: 'custom',
        label: s.label || `Slide ${i + 1}`,
        group: item.title,
        background: s.background ?? background,
        elements: s.elements
      }))
    }

    case 'header':
      return []

    case 'web': {
      const w = item.data.web
      if (!w) return [{ ...mk(0), label: 'No web address', text: item.title }]
      return [
        {
          ...mk(0),
          kind: 'web',
          label: w.title || item.title,
          group: 'Web',
          background: { ...DEFAULT_BACKGROUND, kind: 'color', color: '#000000' },
          web: { url: outputUrl(w.url), title: w.title || item.title }
        }
      ]
    }

    default: {
      // sermon, offering, prayer, other: body text split into paragraphs
      const parts = paragraphs(item.data.body ?? '')
      if (!parts.length) return [{ ...mk(0), label: item.title, group: item.title, text: item.title }]
      return parts.map((p, i) => ({ ...mk(i), label: p.split('\n')[0].slice(0, 40), group: item.title, text: p }))
    }
  }
}

/** Items that can be navigated to during a live presentation. */
export function isPresentable(item: ServiceItem): boolean {
  return !item.hidden && item.type !== 'header'
}
