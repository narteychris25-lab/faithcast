import { create } from 'zustand'
import { mediaUrl } from '@/lib/api'
import { toast } from '@/components/ui/overlays'
import { useApp } from './app'

/**
 * Service audio (walk-in music, offering pads...). One element, owned
 * outside React so navigating between views never interrupts playback.
 */
interface AudioState {
  itemId: string | null
  mediaId: string | null
  title: string
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  loop: boolean
  fadeOut: number
  error: string | null
  play: (o: { itemId: string | null; mediaId: string; title: string; volume?: number; loop?: boolean; fadeIn?: number; fadeOut?: number }) => void
  toggle: () => void
  pause: () => void
  resume: () => void
  stop: (fade?: boolean) => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  setLoop: (v: boolean) => void
}

let el: HTMLAudioElement | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null

function element(): HTMLAudioElement {
  if (el) return el
  el = new Audio()
  el.preload = 'auto'
  el.addEventListener('timeupdate', () => useAudio.setState({ currentTime: el!.currentTime }))
  el.addEventListener('durationchange', () => useAudio.setState({ duration: isFinite(el!.duration) ? el!.duration : 0 }))
  el.addEventListener('play', () => useAudio.setState({ playing: true }))
  el.addEventListener('pause', () => useAudio.setState({ playing: false }))
  el.addEventListener('ended', () => useAudio.setState({ playing: false }))
  el.addEventListener('error', () => {
    if (!el?.getAttribute('src')) return
    useAudio.setState({ playing: false, error: 'Media file unavailable' })
    toast.warning(`Audio "${useAudio.getState().title}" could not be played — media file unavailable.`)
  })
  return el
}

async function applySink(a: HTMLAudioElement) {
  const id = useApp.getState().settings.audio.outputDeviceId
  const withSink = a as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
  if (withSink.setSinkId && id && id !== 'default') await withSink.setSinkId(id).catch(() => undefined)
}

function ramp(a: HTMLAudioElement, to: number, seconds: number, done?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer)
  fadeTimer = null
  if (seconds <= 0) {
    a.volume = Math.max(0, Math.min(1, to))
    done?.()
    return
  }
  const from = a.volume
  const start = performance.now()
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / (seconds * 1000))
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k))
    if (k >= 1) {
      clearInterval(fadeTimer!)
      fadeTimer = null
      done?.()
    }
  }, 40)
}

export const useAudio = create<AudioState>((set, get) => ({
  itemId: null,
  mediaId: null,
  title: '',
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  loop: false,
  fadeOut: 0,
  error: null,

  play(o) {
    const a = element()
    const volume = o.volume ?? useApp.getState().settings.audio.defaultVolume
    set({ itemId: o.itemId, mediaId: o.mediaId, title: o.title, volume, loop: !!o.loop, fadeOut: o.fadeOut ?? 0, error: null, currentTime: 0 })
    a.src = mediaUrl(o.mediaId)
    a.loop = !!o.loop
    a.volume = o.fadeIn ? 0 : volume
    void applySink(a).then(() =>
      a
        .play()
        .then(() => o.fadeIn && ramp(a, volume, o.fadeIn))
        .catch(() => undefined)
    )
  },
  toggle() {
    if (get().playing) get().pause()
    else get().resume()
  },
  pause: () => el?.pause(),
  resume() {
    if (el?.getAttribute('src')) void el.play().catch(() => undefined)
  },
  stop(fade = true) {
    const a = el
    if (!a) return
    const finish = () => {
      a.pause()
      a.removeAttribute('src')
      a.load()
      set({ itemId: null, mediaId: null, title: '', playing: false, currentTime: 0, duration: 0 })
    }
    if (fade && get().fadeOut > 0 && get().playing) ramp(a, 0, get().fadeOut, finish)
    else finish()
  },
  seek(t) {
    if (el) el.currentTime = Math.max(0, t)
  },
  setVolume(v) {
    set({ volume: v })
    if (el) ramp(el, v, 0)
  },
  setLoop(v) {
    set({ loop: v })
    if (el) el.loop = v
  }
}))
