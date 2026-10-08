import { create } from 'zustand'
import type { LiveState, OutputMode, RenderSlide, ServiceItem, VideoStatus } from '@shared/types'
import { isPresentable } from '@shared/slides'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { api } from '@/lib/api'
import { toast, confirmDialog } from '@/components/ui/overlays'
import { useApp } from './app'
import { useService } from './service'
import { getSlides } from './content'
import { useAudio } from './audio'

/**
 * The presentation brain. Lives in the operator window; every change is
 * pushed to the main process which forwards it to the output window.
 */
interface LiveStore {
  itemId: string | null
  /** Navigation position in the service (may be an audio item that isn't on screen). */
  cursorId: string | null
  /** A transient item presented without adding it to a service. */
  quickItem: ServiceItem | null
  slideIndex: number
  slides: RenderSlide[]
  nextSlide: RenderSlide | null
  mode: OutputMode
  paused: boolean
  video: VideoStatus
  videoSeq: number
  videoCommand: LiveState['videoCommand']

  goLive: (item: ServiceItem, slideIndex?: number) => Promise<void>
  /**
   * Put a transient item live without adding it to a service.
   * startIndex: slide to begin on. stay: don't switch to the Live view.
   * If the same content is already live, it just moves to startIndex.
   */
  presentQuick: (
    item: Omit<ServiceItem, 'id' | 'serviceId' | 'position' | 'createdAt' | 'updatedAt'>,
    opts?: { startIndex?: number; stay?: boolean }
  ) => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  first: () => void
  last: () => void
  nextItem: () => Promise<void>
  previousItem: () => Promise<void>
  toggleMode: (mode: Exclude<OutputMode, 'normal'>) => void
  setMode: (mode: OutputMode) => void
  togglePause: () => void
  video_: (action: LiveState['videoCommand']['action'], time?: number, extra?: { volume?: number; muted?: boolean }) => void
  refreshLive: () => Promise<void>
  startOutput: () => Promise<void>
  exit: (confirm?: boolean) => Promise<void>
  setVideoStatus: (s: VideoStatus) => void
}

const EMPTY_VIDEO: VideoStatus = { mediaId: null, playing: false, currentTime: 0, duration: 0, error: null }

function presentable(): ServiceItem[] {
  return (useService.getState().service?.items ?? []).filter(isPresentable)
}

function serviceCtx() {
  const s = useService.getState().service
  return s ? { themeId: s.themeId, background: s.background } : null
}

export const useLive = create<LiveStore>((set, get) => {
  function currentItem(): ServiceItem | null {
    const { itemId, quickItem } = get()
    if (quickItem && quickItem.id === itemId) return quickItem
    return useService.getState().service?.items.find((i) => i.id === itemId) ?? null
  }

  async function computeNext(): Promise<RenderSlide | null> {
    const { slides, slideIndex, quickItem, itemId } = get()
    if (slideIndex + 1 < slides.length) return slides[slideIndex + 1]
    if (quickItem && quickItem.id === itemId) return null
    const items = presentable()
    const idx = items.findIndex((i) => i.id === (get().cursorId ?? itemId))
    for (const it of items.slice(idx + 1)) {
      const s = await getSlides(it, serviceCtx())
      if (s.length) return s[0]
    }
    return null
  }

  function push() {
    const st = get()
    const app = useApp.getState()
    const item = currentItem()
    const slide = st.slides[st.slideIndex] ?? null
    const state: LiveState = {
      serviceId: useService.getState().service?.id ?? null,
      itemId: st.itemId,
      itemTitle: item?.title ?? '',
      slideIndex: st.slideIndex,
      slideCount: st.slides.length,
      slide,
      nextSlide: st.nextSlide,
      mode: st.mode,
      paused: st.paused,
      transition: item?.transition ?? slide?.theme.transition ?? app.settings.presentation.defaultTransition,
      aspectRatio: app.settings.presentation.aspectRatio,
      logoMediaId: app.church.logoMediaId,
      videoCommand: st.videoCommand
    }
    void api('live:update', state).catch((e) => toast.error(e))
  }

  async function show(item: ServiceItem, slides: RenderSlide[], index: number) {
    if (item.type === 'audio' && item.data.mediaId) {
      const m = { ...DEFAULT_MEDIA_SETTINGS, ...item.data.media }
      if (m.autoPlay) {
        useAudio.getState().play({ itemId: item.id, mediaId: item.data.mediaId, title: item.title, volume: m.volume, loop: m.loop, fadeIn: m.fadeIn, fadeOut: m.fadeOut })
      }
      // Audio does not change the picture: keep the current slide on screen.
      set({ cursorId: item.id })
      useService.getState().select(item.id)
      set({ nextSlide: await computeNext() })
      push()
      return
    }
    const i = Math.max(0, Math.min(index, slides.length - 1))
    set({ itemId: item.id, cursorId: item.id, slides, slideIndex: i, mode: get().mode === 'black' || get().mode === 'logo' ? get().mode : 'normal', video: EMPTY_VIDEO })
    if (!get().quickItem || get().quickItem!.id !== item.id) useService.getState().select(item.id)
    set({ nextSlide: await computeNext() })
    push()
  }

  return {
    itemId: null,
    cursorId: null,
    quickItem: null,
    slideIndex: 0,
    slides: [],
    nextSlide: null,
    mode: 'normal',
    paused: false,
    video: EMPTY_VIDEO,
    videoSeq: 0,
    videoCommand: { seq: 0, action: 'play' },

    async goLive(item, slideIndex = 0) {
      if (item.type === 'header') return
      const slides = await getSlides(item, get().quickItem?.id === item.id ? null : serviceCtx())
      if (!get().quickItem || get().quickItem!.id !== item.id) set({ quickItem: null })
      if (!slides.length && item.type !== 'audio') {
        toast.info(`"${item.title}" has no slides to show.`)
        return
      }
      await show(item, slides, slideIndex)
    },

    async presentQuick(partial, opts = {}) {
      const start = opts.startIndex ?? 0
      const existing = get().quickItem
      const same =
        existing &&
        get().itemId === existing.id &&
        existing.type === partial.type &&
        existing.refId === partial.refId &&
        JSON.stringify(existing.data) === JSON.stringify(partial.data)
      if (same) {
        // Same passage already live: just move (keeps slide identity, so it behaves like Next/Previous).
        await show(existing, get().slides, start)
      } else {
        const now = new Date().toISOString()
        const item: ServiceItem = { ...partial, id: `quick-${Date.now()}`, serviceId: '', position: -1, createdAt: now, updatedAt: now }
        set({ quickItem: item })
        const slides = await getSlides(item, null)
        if (!slides.length && item.type !== 'audio') return
        await show(item, slides, start)
      }
      if (!useApp.getState().output.open) await get().startOutput()
      if (!opts.stay) useApp.getState().navigate('live')
    },

    async next() {
      const { slides, slideIndex, itemId } = get()
      const item = currentItem()
      if (!item) {
        // Nothing live yet: start with the selected (or first) item.
        const sel = useService.getState().selectedItemId
        const start = presentable().find((i) => i.id === sel) ?? presentable()[0]
        if (start) await get().goLive(start, 0)
        return
      }
      if (slideIndex + 1 < slides.length && get().cursorId === itemId) {
        set({ slideIndex: slideIndex + 1 })
        set({ nextSlide: await computeNext() })
        push()
        return
      }
      if (!useApp.getState().settings.autoAdvanceToNextItem || get().quickItem?.id === itemId) return
      await get().nextItem()
    },

    async previous() {
      const { slideIndex } = get()
      if (!currentItem()) return
      if (slideIndex > 0 && get().cursorId === get().itemId) {
        set({ slideIndex: slideIndex - 1 })
        set({ nextSlide: await computeNext() })
        push()
        return
      }
      if (!useApp.getState().settings.autoAdvanceToNextItem) return
      const items = presentable()
      const idx = items.findIndex((i) => i.id === (get().cursorId ?? get().itemId))
      for (let k = idx - 1; k >= 0; k--) {
        const s = await getSlides(items[k], serviceCtx())
        if (s.length) {
          await show(items[k], s, s.length - 1)
          return
        }
      }
    },

    first() {
      if (!get().slides.length) return
      set({ slideIndex: 0 })
      void computeNext().then((n) => {
        set({ nextSlide: n })
        push()
      })
    },
    last() {
      if (!get().slides.length) return
      set({ slideIndex: get().slides.length - 1 })
      void computeNext().then((n) => {
        set({ nextSlide: n })
        push()
      })
    },

    async nextItem() {
      const items = presentable()
      const cur = get().cursorId ?? get().itemId ?? useService.getState().selectedItemId
      const idx = items.findIndex((i) => i.id === cur)
      for (const it of items.slice(idx + 1)) {
        const s = await getSlides(it, serviceCtx())
        if (s.length || it.type === 'audio') {
          await show(it, s, 0)
          return
        }
      }
    },
    async previousItem() {
      const items = presentable()
      const idx = items.findIndex((i) => i.id === (get().cursorId ?? get().itemId ?? useService.getState().selectedItemId))
      for (let k = idx - 1; k >= 0; k--) {
        const s = await getSlides(items[k], serviceCtx())
        if (s.length) {
          await show(items[k], s, 0)
          return
        }
      }
    },

    toggleMode(mode) {
      set({ mode: get().mode === mode ? 'normal' : mode })
      push()
    },
    setMode(mode) {
      set({ mode })
      push()
    },
    togglePause() {
      set({ paused: !get().paused })
      push()
    },
    video_(action, time, extra) {
      const seq = get().videoSeq + 1
      set({ videoSeq: seq, videoCommand: { seq, action, time, ...extra } })
      push()
    },

    /** Rebuild the live item's slides after an edit so the output stays accurate. */
    async refreshLive() {
      const item = currentItem()
      if (!item) return
      const slides = await getSlides(item, get().quickItem?.id === item.id ? null : serviceCtx())
      set({ slides, slideIndex: Math.min(get().slideIndex, Math.max(0, slides.length - 1)) })
      set({ nextSlide: await computeNext() })
      push()
    },

    async startOutput() {
      const app = useApp.getState()
      try {
        app.setOutput(await api('output:open', { displayId: effectiveDisplayId() }))
        push()
      } catch (e) {
        toast.error(e)
      }
    },

    async exit(confirm = true) {
      if (confirm && useApp.getState().settings.confirmExitPresentation && useApp.getState().output.open) {
        const ok = await confirmDialog({ title: 'End presentation?', message: 'The audience output will close.', confirmLabel: 'End presentation', danger: true })
        if (!ok) return
      }
      set({ itemId: null, cursorId: null, quickItem: null, slides: [], slideIndex: 0, nextSlide: null, mode: 'normal', paused: false, video: EMPTY_VIDEO })
      push()
      useApp.getState().setOutput(await api('output:close'))
    },

    setVideoStatus: (video) => set({ video })
  }
})

export function liveItem(): ServiceItem | null {
  const { itemId, quickItem } = useLive.getState()
  if (quickItem?.id === itemId) return quickItem
  return useService.getState().service?.items.find((i) => i.id === itemId) ?? null
}

/** null setting = first external display (auto); -1 = always use the preview window. */
export function effectiveDisplayId(): number | null {
  const { settings, displays } = useApp.getState()
  const wanted = settings.presentation.outputDisplayId
  const external = displays.filter((d) => !d.primary)
  if (wanted === -1) return null
  return external.find((d) => d.id === wanted)?.id ?? external[0]?.id ?? null
}
