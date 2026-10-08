import type { AppSettings, RenderSlide } from '@shared/types'
import { mediaUrl } from '@/lib/api'
import { cx } from '@/lib/format'
import { SlideCanvas } from '@/components/slide/SlideCanvas'
import { BackgroundView, SlideView } from '@/components/slide/SlideView'
import { useLive } from '@/stores/live'
import { useApp } from '@/stores/app'

type Aspect = AppSettings['presentation']['aspectRatio']

/** What the audience is seeing right now, including black/clear/logo state. */
export function LiveMonitor({ aspect }: { aspect: Aspect }) {
  const slide = useLive((s) => s.slides[s.slideIndex] ?? null)
  const mode = useLive((s) => s.mode)
  const logo = useApp((s) => s.church.logoMediaId)
  const open = useApp((s) => s.output.open)
  return (
    <Monitor label="LIVE" tone="live" sub={!open ? 'Output closed' : mode !== 'normal' ? mode.toUpperCase() : slide?.label}>
      <SlideCanvas aspect={aspect}>
        {(w, h) => (
          <>
            {slide && mode === 'normal' && <SlideView slide={slide} w={w} h={h} opts={{ live: false }} />}
            {slide && mode === 'clear' && <BackgroundView bg={slide.background} live={false} />}
            {mode === 'logo' && logo && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <img src={mediaUrl(logo)} style={{ maxWidth: '40%', maxHeight: '40%' }} alt="" />
              </div>
            )}
          </>
        )}
      </SlideCanvas>
    </Monitor>
  )
}

export function NextMonitor({ aspect }: { aspect: Aspect }) {
  const next = useLive((s) => s.nextSlide)
  return (
    <Monitor label="NEXT" tone="next" sub={next?.label ?? 'End of service'}>
      <SlideCanvas aspect={aspect}>{(w, h) => (next ? <SlideView slide={next} w={w} h={h} opts={{ live: false }} /> : null)}</SlideCanvas>
    </Monitor>
  )
}

function Monitor({ label, tone, sub, children }: { label: string; tone: 'live' | 'next'; sub?: string; children: React.ReactNode }) {
  return (
    <div className={cx('overflow-hidden rounded-lg border-2', tone === 'live' ? 'border-live' : 'border-next/60')}>
      <div className={cx('flex h-6 items-center gap-2 px-2 text-[11px] font-bold', tone === 'live' ? 'bg-live text-white' : 'bg-next/20 text-next')}>
        {tone === 'live' && <span className="live-dot h-2 w-2 rounded-full bg-white" />}
        {label}
        <span className="truncate font-medium opacity-80">{sub}</span>
      </div>
      {children}
    </div>
  )
}

export function SlideThumb({ slide, index, aspect, live, onClick }: { slide: RenderSlide; index: number; aspect: Aspect; live: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="slide-thumb"
      className={cx('group block w-full overflow-hidden rounded-md border-2 text-left transition-colors', live ? 'border-live' : 'border-line hover:border-accent')}
    >
      <SlideCanvas aspect={aspect}>{(w, h) => <SlideView slide={slide} w={w} h={h} opts={{ live: false }} />}</SlideCanvas>
      <div className={cx('flex items-center gap-2 px-2 py-1 text-[11px]', live ? 'bg-live text-white' : 'bg-panel-2 text-muted')}>
        <span className="font-mono tabular-nums opacity-70">{index + 1}</span>
        <span className="truncate font-medium">{slide.label}</span>
      </div>
    </button>
  )
}
