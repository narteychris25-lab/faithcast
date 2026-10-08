import { memo, type CSSProperties, type ReactNode } from 'react'
import type { Background, ItemMediaSettings, MediaFit, RenderSlide, SlideElement, TextStyle } from '@shared/types'
import { mediaUrl, thumbUrl } from '@/lib/api'
import { FitText } from './FitText'
import { MediaVideo, type VideoHandle } from './MediaVideo'
import { SLIDE_ICONS } from './icons'
import { WebSlide } from './WebSlide'

export interface RenderOptions {
  /** true = real, playing <video> elements (audience output). false = static thumbnails. */
  live: boolean
  paused?: boolean
  /** Receives the foreground video element for transport control. */
  onVideo?: (h: VideoHandle | null) => void
  onMediaError?: (mediaId: string) => void
}

const FIT: Record<MediaFit, CSSProperties['objectFit']> = { cover: 'cover', contain: 'contain', stretch: 'fill' }

function mediaLayerStyle(fit: MediaFit, posX = 50, posY = 50): CSSProperties {
  return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: FIT[fit], objectPosition: `${posX}% ${posY}%` }
}

/** Static or live image/video. Missing files render as nothing (audience never sees an error). */
function MediaEl({
  id,
  type,
  fit,
  posX,
  posY,
  live,
  paused,
  settings,
  style,
  onVideo,
  onMediaError
}: {
  id: string
  type: 'image' | 'video'
  fit: MediaFit
  posX?: number
  posY?: number
  live: boolean
  paused?: boolean
  settings?: Partial<ItemMediaSettings>
  style?: CSSProperties
  onVideo?: (h: VideoHandle | null) => void
  onMediaError?: (mediaId: string) => void
}) {
  const css = { ...mediaLayerStyle(fit, posX, posY), ...style }
  if (type === 'image' || !live) {
    return (
      <img
        src={type === 'image' ? mediaUrl(id) : thumbUrl(id)}
        style={css}
        draggable={false}
        decoding="async"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          onMediaError?.(id)
        }}
        alt=""
      />
    )
  }
  return (
    <MediaVideo
      mediaId={id}
      style={css}
      loop={settings?.loop ?? true}
      muted={settings?.muted ?? true}
      volume={settings?.volume ?? 0}
      paused={!!paused}
      startPaused={settings?.autoPlay === false}
      onHandle={onVideo}
      onError={() => onMediaError?.(id)}
    />
  )
}

export const BackgroundView = memo(function BackgroundView({ bg, live, paused, onMediaError }: { bg: Background; live: boolean; paused?: boolean; onMediaError?: (id: string) => void }) {
  let fill: ReactNode = null
  if (bg.kind === 'color') fill = <div style={{ position: 'absolute', inset: 0, background: bg.color }} />
  else if (bg.kind === 'gradient')
    fill = <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})` }} />
  else if ((bg.kind === 'image' || bg.kind === 'video') && bg.mediaId) {
    fill = (
      <MediaEl
        id={bg.mediaId}
        type={bg.kind}
        fit={bg.fit}
        posX={bg.posX}
        posY={bg.posY}
        live={live}
        paused={paused}
        settings={{ loop: bg.video.loop, muted: bg.video.muted, volume: bg.video.volume }}
        style={{
          opacity: bg.opacity,
          filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
          // Blur softens edges; scale slightly so they stay off-canvas.
          transform: bg.blur > 0 ? `scale(${1 + bg.blur / 200})` : undefined
        }}
        onMediaError={onMediaError}
      />
    )
  }
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg.kind === 'none' ? 'transparent' : '#000' }}>
      {fill}
      {bg.overlayOpacity > 0 && <div style={{ position: 'absolute', inset: 0, background: bg.overlayColor, opacity: bg.overlayOpacity }} />}
      {bg.dim > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: bg.dim }} />}
    </div>
  )
})

function ElementView({ el, theme, live, paused, onMediaError }: { el: SlideElement; theme: TextStyle; live: boolean; paused?: boolean; onMediaError?: (id: string) => void }) {
  const box: CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    opacity: el.opacity,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined
  }
  switch (el.kind) {
    case 'text': {
      const style: TextStyle = {
        ...theme,
        ...el.style,
        shadow: { ...theme.shadow, ...el.style?.shadow },
        outline: { ...theme.outline, ...el.style?.outline },
        box: { ...theme.box, ...el.style?.box }
      }
      return (
        <div style={box}>
          <FitText text={el.text ?? ''} style={style} width={el.w} height={el.h} />
        </div>
      )
    }
    case 'image':
    case 'video':
      return (
        <div style={{ ...box, overflow: 'hidden', borderRadius: el.radius ?? 0 }}>
          {el.mediaId && (
            <MediaEl id={el.mediaId} type={el.kind} fit={el.fit ?? 'cover'} live={live} paused={paused} settings={{ loop: el.loop ?? true, muted: el.muted ?? true, volume: 1 }} onMediaError={onMediaError} />
          )}
        </div>
      )
    case 'shape': {
      const clip = el.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined
      return (
        <div
          style={{
            ...box,
            background: el.fill ?? '#ffffff',
            border: el.strokeWidth && el.shape !== 'triangle' ? `${el.strokeWidth}px solid ${el.stroke ?? '#000'}` : undefined,
            borderRadius: el.shape === 'ellipse' ? '50%' : (el.radius ?? 0),
            clipPath: clip,
            boxSizing: 'border-box'
          }}
        />
      )
    }
    case 'line':
      return <div style={{ ...box, height: Math.max(1, el.strokeWidth ?? 4), top: el.y + el.h / 2, background: el.stroke ?? '#ffffff', borderRadius: 999 }} />
    case 'icon': {
      const Icon = SLIDE_ICONS[el.icon ?? 'star'] ?? SLIDE_ICONS.star
      return (
        <div style={box}>
          <Icon width="100%" height="100%" color={el.fill ?? '#ffffff'} strokeWidth={el.strokeWidth ?? 1.5} />
        </div>
      )
    }
    default:
      return null
  }
}

const LOGO_POS: Record<string, CSSProperties> = {
  'top-left': { top: '4%', left: '3%' },
  'top-right': { top: '4%', right: '3%' },
  'bottom-left': { bottom: '4%', left: '3%' },
  'bottom-right': { bottom: '4%', right: '3%' }
}

/** Foreground (everything except the background) for one slide, at logical canvas size. */
export const ForegroundView = memo(function ForegroundView({ slide, w, h, opts }: { slide: RenderSlide; w: number; h: number; opts: RenderOptions }) {
  const t = slide.theme
  const area = { x: (t.textArea.x / 100) * w, y: (t.textArea.y / 100) * h, w: (t.textArea.w / 100) * w, h: (t.textArea.h / 100) * h }
  const subH = Math.max(t.subtext.fontSize * t.subtext.lineHeight * 2.2, h * 0.08)

  let content: ReactNode = null
  if (slide.kind === 'media' && slide.media) {
    content = (
      <MediaEl
        id={slide.media.mediaId}
        type={slide.media.type}
        fit={slide.media.settings.fit}
        live={opts.live}
        paused={opts.paused}
        settings={slide.media.settings}
        onVideo={opts.onVideo}
        onMediaError={opts.onMediaError}
      />
    )
  } else if (slide.kind === 'web' && slide.web) {
    content = <WebSlide url={slide.web.url} title={slide.web.title} live={opts.live} />
  } else if (slide.kind === 'custom') {
    content = slide.elements.map((el) => <ElementView key={el.id} el={el} theme={t.text} live={opts.live} paused={opts.paused} onMediaError={opts.onMediaError} />)
  } else if (slide.kind === 'announcement') {
    const titleH = area.h * 0.34
    const bodyH = slide.text ? area.h * 0.36 : 0
    content = (
      <div style={{ position: 'absolute', left: area.x, top: area.y, width: area.w, height: area.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: h * 0.02 }}>
        <FitText text={slide.title} style={{ ...t.title, vAlign: 'bottom' }} width={area.w} height={titleH} />
        {slide.text && <FitText text={slide.text} style={{ ...t.text, vAlign: 'top', fontWeight: Math.min(t.text.fontWeight, 500) }} width={area.w} height={bodyH} sizeScale={0.6} />}
        {slide.subtext && <FitText text={slide.subtext} style={{ ...t.subtext, align: t.title.align, fontSize: t.subtext.fontSize * 1.3, color: t.title.color }} width={area.w} height={subH} />}
      </div>
    )
  } else if (slide.kind === 'text') {
    const below = t.subtextPosition === 'below' && !!slide.subtext
    content = (
      <>
        <div style={{ position: 'absolute', left: area.x, top: area.y, width: area.w, height: area.h, display: 'flex', flexDirection: 'column' }}>
          <FitText text={slide.text} style={t.text} width={area.w} height={below ? area.h - subH : area.h} />
          {below && <FitText text={slide.subtext} style={{ ...t.subtext, vAlign: 'top' }} width={area.w} height={subH} />}
        </div>
        {slide.subtext && t.subtextPosition !== 'below' && (
          <div style={{ position: 'absolute', left: area.x, width: area.w, height: subH, ...(t.subtextPosition === 'top' ? { top: h * 0.03 } : { bottom: h * 0.03 }) }}>
            <FitText text={slide.subtext} style={{ ...t.subtext, vAlign: t.subtextPosition === 'top' ? 'top' : 'bottom' }} width={area.w} height={subH} />
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {content}
      {t.showLogo && slide.logoMediaId && (
        <img src={mediaUrl(slide.logoMediaId)} alt="" draggable={false} style={{ position: 'absolute', height: h * 0.09, maxWidth: w * 0.2, objectFit: 'contain', ...LOGO_POS[t.logoPosition] }} />
      )}
    </div>
  )
})

/** Complete slide (background + foreground) at logical size. Used for thumbnails and previews. */
export const SlideView = memo(function SlideView({ slide, w, h, opts }: { slide: RenderSlide; w: number; h: number; opts: RenderOptions }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <BackgroundView bg={slide.background} live={opts.live} paused={opts.paused} onMediaError={opts.onMediaError} />
      <ForegroundView slide={slide} w={w} h={h} opts={opts} />
    </div>
  )
})
