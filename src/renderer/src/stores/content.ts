import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { BibleReference, BibleVerse, MediaItem, RenderSlide, Service, ServiceItem, Song } from '@shared/types'
import { buildSlides, type SlideContext } from '@shared/slides'
import { api } from '@/lib/api'
import { themeMap, useApp } from './app'

/**
 * Lazily-loaded cache of the content that service items reference
 * (songs, Bible passages, media records). Keeps slide building cheap.
 */
interface ContentState {
  songs: Record<string, Song | null>
  passages: Record<string, BibleVerse[]>
  media: Record<string, MediaItem | null>
  /** Bumped when media changes so thumbnails re-fetch. */
  mediaVersion: number
  loadSong: (id: string) => Promise<Song | null>
  loadPassage: (ref: BibleReference) => Promise<BibleVerse[]>
  loadMedia: (ids: string[]) => Promise<void>
  setSong: (song: Song) => void
  forgetSong: (id: string) => void
  invalidateMedia: () => void
}

const inflight = new Map<string, Promise<unknown>>()
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key)
  if (cur) return cur as Promise<T>
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export const refKey = (r: BibleReference) => `${r.translationId}:${r.book}:${r.chapter}:${r.verseStart}:${r.verseEnd}`

export const useContent = create<ContentState>((set, get) => ({
  songs: {},
  passages: {},
  media: {},
  mediaVersion: 0,

  async loadSong(id) {
    if (id in get().songs) return get().songs[id]
    return once(`song:${id}`, async () => {
      const song = await api('songs:get', id).catch(() => null)
      set((s) => ({ songs: { ...s.songs, [id]: song } }))
      return song
    })
  },
  async loadPassage(ref) {
    const key = refKey(ref)
    if (get().passages[key]) return get().passages[key]
    return once(`p:${key}`, async () => {
      const verses = await api('bible:passage', ref).catch(() => [])
      set((s) => ({ passages: { ...s.passages, [key]: verses } }))
      return verses
    })
  },
  async loadMedia(ids) {
    const missing = [...new Set(ids)].filter((id) => !(id in get().media))
    if (!missing.length) return
    const items = await api('media:getMany', missing).catch(() => [])
    const found = new Map(items.map((m) => [m.id, m]))
    set((s) => ({ media: { ...s.media, ...Object.fromEntries(missing.map((id) => [id, found.get(id) ?? null])) } }))
  },
  setSong: (song) => set((s) => ({ songs: { ...s.songs, [song.id]: song } })),
  forgetSong: (id) =>
    set((s) => {
      const songs = { ...s.songs }
      delete songs[id]
      return { songs }
    }),
  invalidateMedia: () => set((s) => ({ media: {}, mediaVersion: s.mediaVersion + 1 }))
}))

function slideContext(service: Pick<Service, 'themeId' | 'background'> | null, item: ServiceItem): SlideContext {
  const app = useApp.getState()
  const content = useContent.getState()
  const bible = item.data.bible
  return {
    service,
    themes: themeMap(app.themes),
    settings: app.settings,
    church: app.church,
    song: item.type === 'song' && item.refId ? (content.songs[item.refId] ?? null) : undefined,
    verses: bible ? content.passages[refKey(bible)] : undefined,
    translationAbbrev: bible ? app.translations.find((t) => t.id === bible.translationId)?.abbreviation : undefined
  }
}

/** Ensure everything an item needs is loaded, then build its slides. */
export async function getSlides(item: ServiceItem, service: Pick<Service, 'themeId' | 'background'> | null): Promise<RenderSlide[]> {
  const c = useContent.getState()
  if (item.type === 'song' && item.refId) await c.loadSong(item.refId)
  if (item.data.bible) await c.loadPassage(item.data.bible)
  return buildSlides(item, slideContext(service, item))
}

/** Reactive slides for an item (re-builds when content, themes or settings change). */
export function useSlides(item: ServiceItem | null | undefined, service: Pick<Service, 'themeId' | 'background'> | null): RenderSlide[] {
  const themes = useApp((s) => s.themes)
  const settings = useApp((s) => s.settings)
  const church = useApp((s) => s.church)
  const translations = useApp((s) => s.translations)
  const song = useContent((s) => (item?.type === 'song' && item.refId ? s.songs[item.refId] : undefined))
  const verses = useContent((s) => (item?.data.bible ? s.passages[refKey(item.data.bible)] : undefined))
  const loadSong = useContent((s) => s.loadSong)
  const loadPassage = useContent((s) => s.loadPassage)

  useEffect(() => {
    if (!item) return
    if (item.type === 'song' && item.refId) void loadSong(item.refId)
    if (item.data.bible) void loadPassage(item.data.bible)
  }, [item, loadSong, loadPassage])

  const serviceThemeId = service?.themeId ?? null
  const serviceBg = service?.background ?? null
  return useMemo(() => {
    if (!item) return []
    if (item.type === 'song' && item.refId && song === undefined) return []
    return buildSlides(item, {
      service: { themeId: serviceThemeId, background: serviceBg },
      themes: themeMap(themes),
      settings,
      church,
      song,
      verses,
      translationAbbrev: item.data.bible ? translations.find((t) => t.id === item.data.bible!.translationId)?.abbreviation : undefined
    })
  }, [item, song, verses, themes, settings, church, translations, serviceThemeId, serviceBg])
}

/** Reactive media record lookup. */
export function useMediaItem(id: string | null | undefined): MediaItem | null | undefined {
  const m = useContent((s) => (id ? s.media[id] : undefined))
  const load = useContent((s) => s.loadMedia)
  useEffect(() => {
    if (id) void load([id])
  }, [id, load])
  return id ? m : null
}
