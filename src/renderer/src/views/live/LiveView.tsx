import { useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleSlash,
  Eraser,
  Image as ImageIcon,
  LogOut,
  Monitor,
  MonitorOff,
  MonitorPlay,
  Pause,
  Play,
  ScanEye,
  Music2
} from 'lucide-react'
import type { ServiceItem } from '@shared/types'
import { isPresentable } from '@shared/slides'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { ITEM_META } from '@/lib/items'
import { comboLabel } from '@/lib/shortcuts'
import { useApp } from '@/stores/app'
import { useService } from '@/stores/service'
import { effectiveDisplayId, useLive } from '@/stores/live'
import { useAudio } from '@/stores/audio'
import { useSlides } from '@/stores/content'
import { Button, EmptyState, Select } from '@/components/ui/controls'
import { toast } from '@/components/ui/overlays'
import { ServiceChooser } from '@/views/planner/Planner'
import { LiveMonitor, NextMonitor, SlideThumb } from './Monitors'
import { AudioPanel, VideoTransport } from './Transport'

export function LiveView() {
  const serviceId = useApp((s) => s.currentServiceId)
  const service = useService((s) => s.service)
  const quick = useLive((s) => s.quickItem)

  useEffect(() => {
    if (serviceId && service?.id !== serviceId) void useService.getState().load(serviceId)
  }, [serviceId, service?.id])

  if (!service && !quick) return <ServiceChooser />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <OutputBar />
      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_minmax(340px,30%)]">
        <ServiceColumn />
        <SlidesColumn />
        <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-line bg-panel p-3">
          <LiveColumn />
        </aside>
      </div>
      <ControlBar />
    </div>
  )
}

function OutputBar() {
  const output = useApp((s) => s.output)
  const displays = useApp((s) => s.displays)
  const settings = useApp((s) => s.settings)
  const service = useService((s) => s.service)
  const external = displays.filter((d) => !d.primary)

  async function chooseDisplay(v: string) {
    await useApp.getState().saveSettings({ presentation: { outputDisplayId: v === 'preview' ? -1 : Number(v) } })
    if (output.open) useApp.getState().setOutput(await api('output:open', { displayId: effectiveDisplayId() }))
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
      <div className="min-w-40 flex-1">
        <div className="truncate text-[15px] font-semibold">{service?.name ?? 'Quick presentation'}</div>
        <div className="text-[11px] text-muted">Live presentation</div>
      </div>
      <div className={cx('flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-[12px]', output.open ? 'border-live/50 bg-live/10' : 'border-line')} data-testid="output-status">
        {output.open ? <MonitorPlay size={14} className="text-live" /> : <MonitorOff size={14} className="text-dim" />}
        {output.open ? (
          <span>
            <b>{output.displayLabel}</b>
            <span className="text-muted">
              {' '}
              · {output.width}×{output.height}
              {output.previewMode && ' · preview'}
            </span>
          </span>
        ) : (
          <span className="text-muted">Output closed</span>
        )}
      </div>
      <Select
        className="w-60"
        aria-label="Presentation display"
        value={String(effectiveDisplayIdFor(settings.presentation.outputDisplayId, external.map((d) => d.id)) ?? 'preview')}
        onChange={(e) => void chooseDisplay(e.target.value)}
      >
        <option value="preview">Preview window (this screen)</option>
        {external.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label} ({d.width}×{d.height})
          </option>
        ))}
      </Select>
      <Button icon={ScanEye} onClick={() => void api('output:identify')} tip="Show a number on every screen">
        Identify
      </Button>
      {output.open ? (
        <Button icon={MonitorOff} onClick={async () => useApp.getState().setOutput(await api('output:close'))}>
          Close output
        </Button>
      ) : (
        <Button variant="live" icon={Monitor} onClick={() => void useLive.getState().startOutput()}>
          Open output
        </Button>
      )}
    </header>
  )
}

function effectiveDisplayIdFor(wanted: number | null, external: number[]): number | null {
  if (wanted === -1) return null
  return external.find((id) => id === wanted) ?? external[0] ?? null
}

function ServiceColumn() {
  const service = useService((s) => s.service)
  const selectedId = useService((s) => s.selectedItemId)
  const liveId = useLive((s) => s.itemId)
  const cursorId = useLive((s) => s.cursorId)
  const quick = useLive((s) => s.quickItem)
  const audioItem = useAudio((s) => (s.playing ? s.itemId : null))
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector(`[data-live-item="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const items: ServiceItem[] = [...(quick ? [quick] : []), ...(service?.items ?? [])]
  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
      <div className="flex h-9 items-center border-b border-line px-3 text-[11px] font-bold tracking-wider text-muted uppercase">Service</div>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-auto p-1.5" aria-label="Service items">
        {items.map((item) => {
          const M = ITEM_META[item.type]
          if (item.type === 'header')
            return (
              <li key={item.id} className="mt-2 px-2 py-1 text-[10px] font-bold tracking-[0.15em] text-dim uppercase">
                {item.title}
              </li>
            )
          const isLive = liveId === item.id
          return (
            <li key={item.id} data-live-item={item.id}>
              <button
                type="button"
                onClick={() => (item === quick ? useService.getState().select(null) : useService.getState().select(item.id))}
                onDoubleClick={() => void useLive.getState().goLive(item, 0)}
                className={cx(
                  'flex h-10 w-full items-center gap-2 rounded-md border px-2 text-left',
                  isLive ? 'border-live bg-live/15' : selectedId === item.id ? 'border-accent/60 bg-accent/10' : 'border-transparent hover:bg-panel-2',
                  !isPresentable(item) && 'opacity-40'
                )}
              >
                <M.icon size={15} className={M.color} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{item === quick ? `Quick: ${item.title}` : item.title}</span>
                {isLive && <span className="rounded bg-live px-1 text-[9px] font-bold text-white">LIVE</span>}
                {!isLive && cursorId === item.id && item.type === 'audio' && <Music2 size={12} className="text-audio" />}
                {audioItem === item.id && <span className="live-dot h-2 w-2 rounded-full bg-audio" />}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function SlidesColumn() {
  const service = useService((s) => s.service)
  const selectedId = useService((s) => s.selectedItemId)
  const quick = useLive((s) => s.quickItem)
  const liveId = useLive((s) => s.itemId)
  const liveIndex = useLive((s) => s.slideIndex)
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  const item = service?.items.find((i) => i.id === selectedId) ?? (quick && (!selectedId || liveId === quick.id) ? quick : null)
  const slides = useSlides(item, item === quick ? null : service)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (item && liveId === item.id) gridRef.current?.querySelector(`[data-slide="${liveIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [liveIndex, liveId, item])

  if (!item) return <main className="min-h-0"><EmptyState icon={MonitorPlay} title="Select a service item">Choose an item on the left to see its slides. Click a slide to show it live.</EmptyState></main>
  const M = ITEM_META[item.type]

  return (
    <main className="flex min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <M.icon size={14} className={M.color} />
        <span className="truncate text-[13px] font-semibold">{item.title}</span>
        <span className="text-[11px] text-dim">{slides.length ? `${slides.length} slides` : ''}</span>
        <span className="flex-1" />
        {item.notes && <span className="max-w-[50%] truncate text-[11px] text-warn" data-tip={item.notes}>Note: {item.notes}</span>}
      </div>
      <div ref={gridRef} className="min-h-0 flex-1 overflow-auto p-3">
        {item.type === 'audio' ? (
          <AudioItemCard item={item} />
        ) : item.type === 'header' ? (
          <EmptyState icon={M.icon} title={item.title}>Section headings organise the service and are skipped during presentation.</EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {slides.map((s, i) => (
              <div key={s.key} data-slide={i}>
                <SlideThumb slide={s} index={i} aspect={aspect} live={liveId === item.id && liveIndex === i} onClick={() => void useLive.getState().goLive(item, i)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function AudioItemCard({ item }: { item: ServiceItem }) {
  const a = useAudio()
  const m = { ...DEFAULT_MEDIA_SETTINGS, ...item.data.media }
  const playingThis = a.itemId === item.id
  return (
    <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-xl border border-audio/40 bg-audio/10 p-6 text-center">
      <Music2 size={32} className="text-audio" />
      <div className="text-base font-semibold">{item.title}</div>
      <div className="text-[12px] text-muted">Audio plays without changing what is on screen.</div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          icon={playingThis && a.playing ? Pause : Play}
          onClick={() => {
            if (playingThis) a.toggle()
            else if (item.data.mediaId) a.play({ itemId: item.id, mediaId: item.data.mediaId, title: item.title, volume: m.volume, loop: m.loop, fadeIn: m.fadeIn, fadeOut: m.fadeOut })
            else toast.warning('No audio file selected for this item.')
          }}
        >
          {playingThis && a.playing ? 'Pause' : playingThis ? 'Resume' : 'Play'}
        </Button>
        {playingThis && (
          <Button size="lg" onClick={() => a.stop(true)}>
            Stop
          </Button>
        )}
      </div>
    </div>
  )
}

function LiveColumn() {
  const aspect = useApp((s) => s.settings.presentation.aspectRatio)
  return (
    <>
      <LiveMonitor aspect={aspect} />
      <VideoTransport />
      <NextMonitor aspect={aspect} />
      <AudioPanel />
    </>
  )
}

function ControlBar() {
  const live = useLive()
  const shortcuts = useApp((s) => s.settings.shortcuts)
  const hasLogo = useApp((s) => !!s.church.logoMediaId)
  const k = (a: keyof typeof shortcuts) => (shortcuts[a][0] ? comboLabel(shortcuts[a][0]) : '')
  const Big = ({ label, icon: Icon, onClick, active, tone, keyHint, disabled, testid }: { label: string; icon: typeof Play; onClick: () => void; active?: boolean; tone?: 'live' | 'warn' | 'accent'; keyHint?: string; disabled?: boolean; testid?: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      data-tip={keyHint ? `${label} (${keyHint})` : label}
      aria-pressed={active}
      className={cx(
        'flex h-14 min-w-20 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors disabled:opacity-35',
        active
          ? tone === 'live'
            ? 'border-live bg-live text-white'
            : tone === 'warn'
              ? 'border-warn bg-warn text-black'
              : 'border-accent bg-accent text-white'
          : 'border-line bg-panel-3 text-fg hover:bg-line'
      )}
    >
      <Icon size={18} />
      <span>
        {label}
        {keyHint && <span className="ml-1 font-normal opacity-50">{keyHint}</span>}
      </span>
    </button>
  )
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-panel px-3 py-2">
      <Big label="First" icon={ChevronsLeft} onClick={live.first} keyHint={k('firstSlide')} testid="ctl-first" />
      <Big label="Previous" icon={ChevronLeft} onClick={() => void live.previous()} keyHint={k('previous')} testid="ctl-prev" />
      <button
        type="button"
        onClick={() => void live.next()}
        data-testid="ctl-next"
        data-tip={`Next (${k('next')})`}
        className="flex h-14 min-w-36 flex-col items-center justify-center rounded-lg bg-accent px-6 text-[14px] font-bold text-white hover:bg-accent-strong"
      >
        <ChevronRight size={22} />
        Next <span className="text-[11px] font-normal opacity-70">{k('next')}</span>
      </button>
      <Big label="Last" icon={ChevronsRight} onClick={live.last} keyHint={k('lastSlide')} testid="ctl-last" />
      <span className="mx-2 h-10 w-px bg-line" />
      <Big label="Black" icon={CircleSlash} onClick={() => live.toggleMode('black')} active={live.mode === 'black'} tone="live" keyHint={k('black')} testid="ctl-black" />
      <Big label="Clear" icon={Eraser} onClick={() => live.toggleMode('clear')} active={live.mode === 'clear'} tone="warn" keyHint={k('clear')} testid="ctl-clear" />
      <Big label="Logo" icon={ImageIcon} onClick={() => (hasLogo ? live.toggleMode('logo') : toast.info('Add a church logo in Settings → Church first.'))} active={live.mode === 'logo'} tone="accent" keyHint={k('logo')} testid="ctl-logo" />
      <Big label={live.paused ? 'Resume' : 'Pause'} icon={live.paused ? Play : Pause} onClick={live.togglePause} active={live.paused} tone="warn" keyHint={k('pause')} testid="ctl-pause" />
      <span className="flex-1" />
      <div className="mr-2 text-right text-[11px] text-muted">
        {live.itemId ? (
          <>
            Slide <b className="text-fg">{live.slideIndex + 1}</b> of {live.slides.length}
          </>
        ) : (
          'Nothing live'
        )}
      </div>
      <Big label="Exit" icon={LogOut} onClick={() => void live.exit()} keyHint={k('exit')} testid="ctl-exit" />
    </footer>
  )
}
