import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { TextStyle } from '@shared/types'

/**
 * Text block that shrinks its font size (binary search) until it fits its
 * box. Measurements happen in logical canvas pixels, so the operator's
 * thumbnails and the projector output always wrap identically.
 */

const cache = new Map<string, number>()
const CACHE_MAX = 3000

export function textCss(s: TextStyle): CSSProperties {
  const shadow = s.shadow.enabled ? `${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur}px ${s.shadow.color}` : 'none'
  return {
    fontFamily: `"${s.fontFamily}", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`,
    fontWeight: s.fontWeight,
    fontStyle: s.italic ? 'italic' : 'normal',
    color: s.color,
    textAlign: s.align,
    lineHeight: s.lineHeight,
    letterSpacing: `${s.letterSpacing}px`,
    textTransform: s.uppercase ? 'uppercase' : 'none',
    textShadow: shadow,
    WebkitTextStroke: s.outline.enabled && s.outline.width > 0 ? `${s.outline.width}px ${s.outline.color}` : undefined,
    paintOrder: 'stroke fill',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word'
  }
}

function hexToRgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!m) return color
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`
}

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const
const ALIGN_ITEMS = { left: 'flex-start', center: 'center', right: 'flex-end' } as const

interface Props {
  text: string
  style: TextStyle
  width: number
  height: number
  /** Scale applied to the style's font size (e.g. announcement descriptions). */
  sizeScale?: number
}

export const FitText = memo(function FitText({ text, style, width, height, sizeScale = 1 }: Props) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const max = Math.max(4, Math.round(style.fontSize * sizeScale))
  const min = Math.min(max, Math.max(4, Math.round(style.minFontSize * sizeScale)))
  const pad = style.box.enabled ? style.box.padding : 0

  useLayoutEffect(() => {
    const el = inner.current
    const box = outer.current
    if (!el || !box) return
    // Not laid out (e.g. inside a hidden panel): don't measure or cache garbage.
    if (!style.autoFit || !text || box.offsetWidth === 0) {
      el.style.fontSize = `${max}px`
      return
    }
    const key = `${text}|${style.fontFamily}|${style.fontWeight}|${style.italic}|${style.uppercase}|${style.lineHeight}|${style.letterSpacing}|${pad}|${max}|${min}|${Math.round(width)}x${Math.round(height)}`
    const hit = cache.get(key)
    if (hit !== undefined) {
      el.style.fontSize = `${hit}px`
      return
    }
    const availW = width
    const availH = height
    const fits = (size: number) => {
      el.style.fontSize = `${size}px`
      return el.scrollHeight <= availH + 1 && el.scrollWidth <= availW + 1
    }
    let size = max
    if (!fits(max)) {
      let lo = min
      let hi = max
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        if (fits(mid)) lo = mid
        else hi = mid
      }
      size = lo
      el.style.fontSize = `${size}px`
    }
    if (cache.size > CACHE_MAX) cache.clear()
    cache.set(key, size)
  }, [text, style, width, height, max, min, pad])

  return (
    <div
      ref={outer}
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: JUSTIFY[style.vAlign],
        alignItems: ALIGN_ITEMS[style.align],
        overflow: 'hidden'
      }}
    >
      <div
        ref={inner}
        style={{
          ...textCss(style),
          fontSize: max,
          maxWidth: width,
          maxHeight: style.autoFit ? undefined : height,
          boxSizing: 'border-box',
          padding: pad,
          borderRadius: style.box.enabled ? style.box.radius : 0,
          background: style.box.enabled ? hexToRgba(style.box.color, style.box.opacity) : 'transparent'
        }}
      >
        {text}
      </div>
    </div>
  )
})
