import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { AppSettings, RenderSlide } from '@shared/types'
import { canvasSize } from '@shared/defaults'
import { cx } from '@/lib/format'
import { SlideView, type RenderOptions } from './SlideView'

type Aspect = AppSettings['presentation']['aspectRatio']

/**
 * Renders children on a fixed logical canvas (e.g. 1920×1080) scaled to fit
 * the available width. If `width` is omitted the canvas fills its parent.
 */
export function SlideCanvas({
  aspect,
  width,
  className,
  fitHeight = false,
  children
}: {
  aspect: Aspect
  width?: number
  className?: string
  /** Also constrain by the parent's height (only for boxes with a fixed height). */
  fitHeight?: boolean
  children: (w: number, h: number) => ReactNode
}) {
  const { w, h } = canvasSize(aspect)
  const ref = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(width ?? 0)

  useLayoutEffect(() => {
    if (width !== undefined) return
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      // Fit inside both dimensions of the parent box.
      const byW = r.width
      const byH = fitHeight && el.parentElement ? el.parentElement.getBoundingClientRect().height * (w / h) : byW
      setMeasured(Math.max(0, Math.floor(Math.min(byW, byH || byW))))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (fitHeight && el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [width, w, h, fitHeight])

  const outW = width ?? measured
  const scale = outW / w
  return (
    <div ref={width === undefined ? ref : undefined} className={cx('relative w-full', width === undefined && 'flex items-center justify-center')}>
      <div className={cx('relative overflow-hidden bg-black', className)} style={{ width: outW, height: outW * (h / w) }}>
        {outW > 0 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            {children(w, h)}
          </div>
        )}
      </div>
    </div>
  )
}

const STATIC: RenderOptions = { live: false }

/** Static slide thumbnail/preview (videos show their poster frame). */
export function SlidePreview({ slide, aspect, width, className }: { slide: RenderSlide | null; aspect: Aspect; width?: number; className?: string }) {
  return (
    <SlideCanvas aspect={aspect} width={width} className={className}>
      {(w, h) => (slide ? <SlideView slide={slide} w={w} h={h} opts={STATIC} /> : null)}
    </SlideCanvas>
  )
}
