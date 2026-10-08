import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { LiveState, Transition, VideoStatus } from '@shared/types'
import { backgroundKey } from '@shared/slides'
import { canvasSize } from '@shared/defaults'
import { api, mediaUrl, onEvent } from '@/lib/api'
import { BackgroundView, ForegroundView } from '@/components/slide/SlideView'
import type { VideoHandle } from '@/components/slide/MediaVideo'
import type { WebviewEl } from '@/webview'

/**
 * Audience output. Renders whatever the operator sends, with lightweight
 * GPU-friendly transitions (opacity/transform only). No UI chrome, no cursor.
 */

interface Layer<T> {
  id: number
  key: string
  value: T
  leaving: boolean
}

function keyframes(t: Transition, dir: 'in' | 'out'): { frames: Keyframe[]; opts: KeyframeAnimationOptions } {
  const d = t.type === 'cut' ? 0 : Math.max(0, t.duration)
  switch (t.type) {
    case 'fade': // fade through: out first half, in second half
      return dir === 'in'
        ? { frames: [{ opacity: 0 }, { opacity: 1 }], opts: { duration: d / 2, delay: d / 2, fill: 'both', easing: 'ease-out' } }
        : { frames: [{ opacity: 1 }, { opacity: 0 }], opts: { duration: d / 2, fill: 'both', easing: 'ease-in' } }
    case 'dissolve':
      return dir === 'in'
        ? { frames: [{ opacity: 0, transform: 'scale(1.015)' }, { opacity: 1, transform: 'scale(1)' }], opts: { duration: d, fill: 'both', easing: 'ease-in-out' } }
        : { frames: [{ opacity: 1 }, { opacity: 0 }], opts: { duration: d, fill: 'both', easing: 'ease-in-out' } }
    case 'slide':
      return dir === 'in'
        ? { frames: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], opts: { duration: d, fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)' } }
        : { frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], opts: { duration: d, fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)' } }
    case 'crossfade':
      return dir === 'in'
        ? { frames: [{ opacity: 0 }, { opacity: 1 }], opts: { duration: d, fill: 'both' } }
        : { frames: [{ opacity: 1 }, { opacity: 0 }], opts: { duration: d, fill: 'both' } }
    default:
      return { frames: [], opts: { duration: 0 } }
  }
}

function LayerEl({ leaving, transition, onGone, children, first }: { leaving: boolean; transition: Transition; onGone: () => void; children: ReactNode; first: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (first || !ref.current) return
    const { frames, opts } = keyframes(transition, 'in')
    if (frames.length && Number(opts.duration) > 0) ref.current.animate(frames, opts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => {
    if (!leaving || !ref.current) return
    const { frames, opts } = keyframes(transition, 'out')
    if (!frames.length || !Number(opts.duration)) return onGone()
    const anim = ref.current.animate(frames, opts)
    anim.onfinish = onGone
    anim.oncancel = onGone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, willChange: 'opacity, transform' }}>
      {children}
    </div>
  )
}

/** Keeps outgoing layers mounted until their exit animation finishes. */
function TransitionStack<T>({ itemKey, value, transition, render }: { itemKey: string; value: T; transition: Transition; render: (v: T) => ReactNode }) {
  const [layers, setLayers] = useState<Layer<T>[]>([])
  const counter = useRef(0)
  const firstRef = useRef(true)
  useLayoutEffect(() => {
    setLayers((prev) => {
      const top = prev.filter((l) => !l.leaving).at(-1)
      if (top && top.key === itemKey) return prev.map((l) => (l === top ? { ...l, value } : l))
      const next = prev.map((l) => ({ ...l, leaving: true }))
      counter.current += 1
      // Cap stacked layers so rapid clicking never piles up decoders.
      return [...next.slice(-2), { id: counter.current, key: itemKey, value, leaving: false }]
    })
  }, [itemKey, value])
  const isFirst = firstRef.current
  useEffect(() => {
    firstRef.current = false
  }, [])
  return (
    <>
      {layers.map((l) => (
        <LayerEl key={l.id} leaving={l.leaving} transition={transition} first={isFirst} onGone={() => setLayers((p) => p.filter((x) => x.id !== l.id))}>
          {render(l.value)}
        </LayerEl>
      ))}
    </>
  )
}

/**
 * A live web page (Internet section) at real screen pixels, in an isolated
 * <webview> (see main/web.ts). Hidden — not unloaded — for Black/Clear/Logo,
 * and its media pause with the Pause control.
 */
function LiveWebPage({ url, box, visible, paused }: { url: string; box: React.CSSProperties; visible: boolean; paused: boolean }) {
  const ref = useRef<WebviewEl>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      void el.executeJavaScript(`document.querySelectorAll('video,audio').forEach(m => m.${paused ? 'pause()' : 'play().catch(()=>{})'})`).catch(() => undefined)
    } catch {
      /* page still loading */
    }
  }, [paused])
  return (
    <webview
      ref={ref as never}
      src={url}
      partition="persist:web"
      httpreferrer="https://faithcast.app/"
      style={{ position: 'absolute', ...box, background: '#000', visibility: visible ? 'visible' : 'hidden' }}
    />
  )
}

export function OutputApp() {
  const [state, setState] = useState<LiveState | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const video = useRef<VideoHandle | null>(null)
  const lastSeq = useRef(0)
  const mediaError = useRef<string | null>(null)

  useEffect(() => {
    const off = onEvent('live:state', setState)
    void api('live:get').then((s) => s && setState(s))
    void api('output:ready')
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      void api('output:key', { code: e.code, shift: e.shiftKey, meta: e.metaKey, alt: e.altKey, ctrl: e.ctrlKey })
    }
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    // Report foreground video progress to the operator.
    let sentEmpty = false
    const timer = setInterval(() => {
      const h = video.current
      if (h && h.el.isConnected) {
        sentEmpty = false
        const status: VideoStatus = {
          mediaId: h.mediaId,
          playing: !h.el.paused && !h.el.ended,
          currentTime: h.el.currentTime,
          duration: isFinite(h.el.duration) ? h.el.duration : 0,
          error: mediaError.current,
          muted: h.el.muted,
          volume: h.el.volume
        }
        void api('output:videoStatus', status)
      } else if (!sentEmpty) {
        sentEmpty = true
        void api('output:videoStatus', { mediaId: null, playing: false, currentTime: 0, duration: 0, error: mediaError.current })
      }
    }, 400)
    return () => {
      off()
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Apply transport commands from the operator.
  useEffect(() => {
    const cmd = state?.videoCommand
    if (!cmd || cmd.seq <= lastSeq.current) return
    lastSeq.current = cmd.seq
    const el = video.current?.el
    if (!el || !el.isConnected) return
    if (cmd.muted !== undefined) el.muted = cmd.muted
    if (cmd.volume !== undefined) el.volume = cmd.volume
    if (cmd.action === 'play') void el.play().catch(() => undefined)
    if (cmd.action === 'pause') el.pause()
    if (cmd.action === 'restart') {
      el.currentTime = 0
      void el.play().catch(() => undefined)
    }
    if (cmd.action === 'seek' && cmd.time !== undefined) el.currentTime = cmd.time
  }, [state?.videoCommand])

  // New slide → clear any previous media error.
  useEffect(() => {
    mediaError.current = null
  }, [state?.slide?.key])

  const aspect = state?.aspectRatio ?? '16:9'
  const { w, h } = canvasSize(aspect)
  const scale = Math.min(size.w / w, size.h / h)
  const transition = state?.transition ?? { type: 'fade', duration: 300 }
  const slide = state?.slide ?? null
  const mode = state?.mode ?? 'normal'
  const overlayDur = transition.type === 'cut' ? 0 : Math.min(600, transition.duration)
  const onMediaError = (id: string) => {
    mediaError.current = 'Media file unavailable'
    void id
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: w,
          height: h,
          left: (size.w - w * scale) / 2,
          top: (size.h - h * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          overflow: 'hidden'
        }}
      >
        {slide && (
          <TransitionStack
            itemKey={backgroundKey(slide.background)}
            value={slide.background}
            transition={transition}
            render={(bg) => <BackgroundView bg={bg} live paused={state?.paused} onMediaError={onMediaError} />}
          />
        )}
        {slide && (
          <TransitionStack
            itemKey={mode === 'clear' ? `${slide.key}:clear` : slide.key}
            value={mode === 'clear' ? null : slide}
            transition={transition}
            render={(s) =>
              s ? (
                <ForegroundView
                  slide={s}
                  w={w}
                  h={h}
                  opts={{
                    live: true,
                    paused: state?.paused,
                    onVideo: (hnd) => {
                      if (hnd) video.current = hnd
                    },
                    onMediaError
                  }}
                />
              ) : null
            }
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: mode === 'black' || mode === 'logo' ? 1 : 0, transition: `opacity ${overlayDur}ms ease`, pointerEvents: 'none' }} />
        {state?.logoMediaId && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: mode === 'logo' ? 1 : 0, transition: `opacity ${overlayDur}ms ease`, pointerEvents: 'none' }}>
            <img src={mediaUrl(state.logoMediaId)} style={{ maxWidth: '40%', maxHeight: '40%', objectFit: 'contain' }} alt="" />
          </div>
        )}
      </div>
      {slide?.kind === 'web' && slide.web && (
        <LiveWebPage
          key={slide.key}
          url={slide.web.url}
          box={{ left: (size.w - w * scale) / 2, top: (size.h - h * scale) / 2, width: w * scale, height: h * scale }}
          visible={mode === 'normal'}
          paused={!!state?.paused}
        />
      )}
    </div>
  )
}
