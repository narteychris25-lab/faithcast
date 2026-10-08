import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  BookMarked,
  BringToFront,
  Circle,
  Copy,
  Film,
  Image as ImageIcon,
  Minus,
  Plus,
  Redo2,
  SendToBack,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2
} from 'lucide-react'
import type { CustomSlide, RenderSlide, ServiceItem, SlideElement } from '@shared/types'
import { canvasSize, DEFAULT_TEXT_STYLE } from '@shared/defaults'
import { resolveBackground, resolveTheme } from '@shared/slides'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { themeMap, useApp } from '@/stores/app'
import { useService } from '@/stores/service'
import { SlideView } from '@/components/slide/SlideView'
import { SlidePreview } from '@/components/slide/SlideCanvas'
import { SLIDE_ICONS } from '@/components/slide/icons'
import { BackgroundOverride, MediaPicker, Section, TextStyleEditor } from '@/components/editors'
import { Button, ColorInput, Field, IconButton, Input, Segmented, Slider, Textarea, Toggle } from '@/components/ui/controls'
import { confirmDialog, openContextMenu, promptDialog, toast } from '@/components/ui/overlays'
import { IS_MAC, isMod } from '@/lib/platform'
import { comboLabel } from '@/lib/shortcuts'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot'
interface DragState {
  kind: 'move' | 'resize' | 'rotate'
  handle?: Handle
  id: string
  startX: number
  startY: number
  orig: SlideElement
}

const SNAP = 10

function newSlide(n: number): CustomSlide {
  return { id: crypto.randomUUID(), label: `Slide ${n}`, background: null, elements: [], notes: '' }
}

export function SlideEditor({ item, onClose, onSave }: { item: ServiceItem; onClose: () => void; onSave: (slides: CustomSlide[]) => void }) {
  const app = useApp()
  const service = useService((s) => s.service)
  const { w: CW, h: CH } = canvasSize(app.settings.presentation.aspectRatio)
  const [slides, setSlides] = useState<CustomSlide[]>(() => (item.data.slides?.length ? structuredClone(item.data.slides) : [newSlide(1)]))
  const [current, setCurrent] = useState(0)
  const [selId, setSelId] = useState<string | null>(null)
  const [history, setHistory] = useState<{ past: CustomSlide[][]; future: CustomSlide[][] }>({ past: [], future: [] })
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [picker, setPicker] = useState<null | 'image' | 'video' | 'bg'>(null)
  const [dirty, setDirty] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(900)
  const drag = useRef<DragState | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const draftKey = `slides:${item.id}`

  const slide = slides[Math.min(current, slides.length - 1)]
  const sel = slide?.elements.find((e) => e.id === selId) ?? null
  const scale = stageW / CW

  // Offer a crash-recovery draft.
  useEffect(() => {
    void api('drafts:get', draftKey).then(async (d) => {
      if (Array.isArray(d) && d.length && (await confirmDialog({ title: 'Restore unsaved slide edits?', message: 'Unsaved changes to these slides were found from a previous session.', confirmLabel: 'Restore' }))) {
        setSlides(d as CustomSlide[])
        setDirty(true)
      }
    })
  }, [draftKey])

  useEffect(() => {
    const el = stageRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setStageW(Math.max(200, Math.min(r.width - 48, ((r.height - 48) * CW) / CH)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [CW, CH])

  const ctx = useMemo(
    () => ({ service: service ? { themeId: service.themeId, background: service.background } : null, themes: themeMap(app.themes), settings: app.settings, church: app.church }),
    [service, app.themes, app.settings, app.church]
  )
  const theme = resolveTheme(item, ctx)
  const baseBg = resolveBackground(item, theme, ctx)
  const render = useCallback(
    (s: CustomSlide): RenderSlide => ({ key: s.id, kind: 'custom', label: s.label, group: '', text: '', subtext: '', title: '', theme, background: s.background ?? baseBg, media: null, elements: s.elements, logoMediaId: app.church.logoMediaId }),
    [theme, baseBg, app.church.logoMediaId]
  )

  // ------------------------------------------------------------ mutations

  function commit(next: CustomSlide[]) {
    setHistory((h) => ({ past: [...h.past.slice(-49), slides], future: [] }))
    setSlides(next)
    setDirty(true)
    void api('drafts:save', { key: draftKey, label: `Slides: ${item.title}`, data: next })
  }
  const updateSlide = (patch: Partial<CustomSlide>) => commit(slides.map((s, i) => (i === current ? { ...s, ...patch } : s)))
  const updateEl = (id: string, patch: Partial<SlideElement>, record = true) => {
    const next = slides.map((s, i) => (i === current ? { ...s, elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : s))
    if (record) commit(next)
    else setSlides(next)
  }
  function addEl(el: Omit<SlideElement, 'id' | 'rotation' | 'opacity'>) {
    const full: SlideElement = { id: crypto.randomUUID(), rotation: 0, opacity: 1, ...el }
    // Never drop a new element exactly on top of an existing one.
    while (slide.elements.some((e) => Math.abs(e.x - full.x) < 4 && Math.abs(e.y - full.y) < 4)) {
      full.x += 40
      full.y += 40
    }
    commit(slides.map((s, i) => (i === current ? { ...s, elements: [...s.elements, full] } : s)))
    setSelId(full.id)
    if (full.kind === 'text') setTimeout(() => textRef.current?.select(), 50)
  }
  function removeSel() {
    if (!sel || sel.locked) return
    commit(slides.map((s, i) => (i === current ? { ...s, elements: s.elements.filter((e) => e.id !== sel.id) } : s)))
    setSelId(null)
  }
  function duplicateSel() {
    if (!sel) return
    const copy = { ...structuredClone(sel), id: crypto.randomUUID(), x: sel.x + 30, y: sel.y + 30, locked: false }
    commit(slides.map((s, i) => (i === current ? { ...s, elements: [...s.elements, copy] } : s)))
    setSelId(copy.id)
  }
  function layer(dir: 'front' | 'back' | 'up' | 'down') {
    if (!sel) return
    const els = [...slide.elements]
    const i = els.findIndex((e) => e.id === sel.id)
    els.splice(i, 1)
    const to = dir === 'front' ? els.length : dir === 'back' ? 0 : dir === 'up' ? Math.min(els.length, i + 1) : Math.max(0, i - 1)
    els.splice(to, 0, sel)
    updateSlide({ elements: els })
  }
  function align(a: 'l' | 'c' | 'r' | 't' | 'm' | 'b') {
    if (!sel) return
    const p: Partial<SlideElement> = a === 'l' ? { x: 0 } : a === 'c' ? { x: (CW - sel.w) / 2 } : a === 'r' ? { x: CW - sel.w } : a === 't' ? { y: 0 } : a === 'm' ? { y: (CH - sel.h) / 2 } : { y: CH - sel.h }
    updateEl(sel.id, p)
  }
  function undo() {
    if (!history.past.length) return
    const prev = history.past[history.past.length - 1]
    setHistory({ past: history.past.slice(0, -1), future: [slides, ...history.future] })
    setSlides(prev)
  }
  function redo() {
    if (!history.future.length) return
    const next = history.future[0]
    setHistory({ past: [...history.past, slides], future: history.future.slice(1) })
    setSlides(next)
  }

  // ------------------------------------------------------------ pointer interaction

  function toLogical(e: { clientX: number; clientY: number }) {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  function startDrag(e: React.PointerEvent, el: SlideElement, kind: DragState['kind'], handle?: Handle) {
    e.stopPropagation()
    e.preventDefault()
    setSelId(el.id)
    if (el.locked) return
    const p = toLogical(e)
    drag.current = { kind, handle, id: el.id, startX: p.x, startY: p.y, orig: { ...el } }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setHistory((h) => ({ past: [...h.past.slice(-49), slides], future: [] }))
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toLogical(e)
    const dx = p.x - d.startX
    const dy = p.y - d.startY
    const o = d.orig
    if (d.kind === 'move') {
      let x = o.x + dx
      let y = o.y + dy
      // Alignment guides: canvas edges/centre and other elements' edges/centres.
      const others = slide.elements.filter((x2) => x2.id !== d.id)
      const xs = [0, CW / 2, CW, ...others.flatMap((q) => [q.x, q.x + q.w / 2, q.x + q.w])]
      const ys = [0, CH / 2, CH, ...others.flatMap((q) => [q.y, q.y + q.h / 2, q.y + q.h])]
      const gx: number[] = []
      const gy: number[] = []
      if (!e.altKey) {
        for (const [off, cand] of [[0, x], [o.w / 2, x + o.w / 2], [o.w, x + o.w]] as const) {
          const hit = xs.find((v) => Math.abs(v - cand) < SNAP / Math.max(scale, 0.3))
          if (hit !== undefined) {
            x = hit - off
            gx.push(hit)
            break
          }
        }
        for (const [off, cand] of [[0, y], [o.h / 2, y + o.h / 2], [o.h, y + o.h]] as const) {
          const hit = ys.find((v) => Math.abs(v - cand) < SNAP / Math.max(scale, 0.3))
          if (hit !== undefined) {
            y = hit - off
            gy.push(hit)
            break
          }
        }
      }
      setGuides({ x: gx, y: gy })
      updateEl(d.id, { x: Math.round(x), y: Math.round(y) }, false)
    } else if (d.kind === 'resize') {
      const h = d.handle!
      let { x, y, w, h: hh } = o
      if (h.includes('e')) w = Math.max(20, o.w + dx)
      if (h.includes('s')) hh = Math.max(20, o.h + dy)
      if (h.includes('w')) {
        w = Math.max(20, o.w - dx)
        x = o.x + (o.w - w)
      }
      if (h.includes('n')) {
        hh = Math.max(20, o.h - dy)
        y = o.y + (o.h - hh)
      }
      if (e.shiftKey && h.length === 2) {
        // keep aspect ratio on corner handles
        const ratio = o.w / o.h
        if (w / hh > ratio) w = hh * ratio
        else hh = w / ratio
        if (h.includes('w')) x = o.x + o.w - w
        if (h.includes('n')) y = o.y + o.h - hh
      }
      updateEl(d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) }, false)
    } else {
      const cx = o.x + o.w / 2
      const cy = o.y + o.h / 2
      let angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90
      if (e.shiftKey) angle = Math.round(angle / 15) * 15
      updateEl(d.id, { rotation: Math.round(((angle % 360) + 360) % 360) }, false)
    }
  }

  function onPointerUp() {
    if (drag.current) {
      drag.current = null
      setGuides({ x: [], y: [] })
      setDirty(true)
      void api('drafts:save', { key: draftKey, label: `Slides: ${item.title}`, data: slides })
    }
  }

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || document.querySelectorAll('[data-modal]').length > 1) return
      if (isMod(e) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return e.shiftKey ? redo() : undo()
      }
      if (!IS_MAC && e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        return redo()
      }
      if (!sel) return
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (moves[e.key] && !sel.locked) {
        e.preventDefault()
        updateEl(sel.id, { x: sel.x + moves[e.key][0], y: sel.y + moves[e.key][1] })
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        removeSel()
      } else if (isMod(e) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSel()
      } else if (e.key === 'Escape') {
        e.stopPropagation()
        setSelId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ------------------------------------------------------------ close / save

  function done() {
    onSave(slides)
    void api('drafts:delete', draftKey)
    onClose()
  }
  async function cancel() {
    if (dirty && !(await confirmDialog({ title: 'Discard changes to these slides?', danger: true, confirmLabel: 'Discard' }))) return
    void api('drafts:delete', draftKey)
    onClose()
  }
  async function saveToLibrary() {
    const name = await promptDialog({ title: 'Save slides to library', defaultValue: item.title })
    if (!name) return
    await api('slides:save', { name, slides })
    toast.success(`Saved “${name}” to the slide library`)
  }
  async function insertFromLibrary(e: React.MouseEvent) {
    const decks = await api('slides:list')
    if (!decks.length) return toast.info('The slide library is empty. Use “Save to library” to add slides.')
    openContextMenu(
      e,
      decks.map((d) => ({
        label: `${d.name} (${d.slides.length})`,
        icon: BookMarked,
        onSelect: () => {
          const copies = structuredClone(d.slides).map((s) => ({ ...s, id: crypto.randomUUID(), elements: s.elements.map((el) => ({ ...el, id: crypto.randomUUID() })) }))
          commit([...slides, ...copies])
          setCurrent(slides.length)
        }
      }))
    )
  }

  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const handlePos: Record<string, React.CSSProperties> = {
    nw: { left: -5, top: -5, cursor: 'nwse-resize' },
    n: { left: '50%', top: -5, marginLeft: -5, cursor: 'ns-resize' },
    ne: { right: -5, top: -5, cursor: 'nesw-resize' },
    e: { right: -5, top: '50%', marginTop: -5, cursor: 'ew-resize' },
    se: { right: -5, bottom: -5, cursor: 'nwse-resize' },
    s: { left: '50%', bottom: -5, marginLeft: -5, cursor: 'ns-resize' },
    sw: { left: -5, bottom: -5, cursor: 'nesw-resize' },
    w: { left: -5, top: '50%', marginTop: -5, cursor: 'ew-resize' }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" data-modal>
      <header className="drag titlebar flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel pr-3">
        <span className="mr-3 truncate text-[13px] font-semibold">Slide editor — {item.title}</span>
        <div className="no-drag flex items-center gap-1">
          <IconButton icon={Undo2} label={`Undo (${comboLabel('Mod+KeyZ')})`} onClick={undo} disabled={!history.past.length} />
          <IconButton icon={Redo2} label={`Redo (${comboLabel(IS_MAC ? 'Mod+Shift+KeyZ' : 'Mod+KeyY')})`} onClick={redo} disabled={!history.future.length} />
          <span className="mx-1 h-6 w-px bg-line" />
          <Button size="sm" icon={Type} onClick={() => addEl({ kind: 'text', x: CW * 0.1, y: CH * 0.38, w: CW * 0.8, h: CH * 0.24, text: 'New text' })}>Text</Button>
          <Button size="sm" icon={ImageIcon} onClick={() => setPicker('image')}>Image</Button>
          <Button size="sm" icon={Film} onClick={() => setPicker('video')}>Video</Button>
          <Button
            size="sm"
            icon={Shapes}
            onClick={(e) =>
              openContextMenu(e, [
                { label: 'Rectangle', icon: Square, onSelect: () => addEl({ kind: 'shape', shape: 'rect', x: CW * 0.35, y: CH * 0.35, w: CW * 0.3, h: CH * 0.3, fill: '#0b6cf5', radius: 16 }) },
                { label: 'Ellipse', icon: Circle, onSelect: () => addEl({ kind: 'shape', shape: 'ellipse', x: CW * 0.4, y: CH * 0.3, w: CH * 0.4, h: CH * 0.4, fill: '#22c55e' }) },
                { label: 'Triangle', icon: Triangle, onSelect: () => addEl({ kind: 'shape', shape: 'triangle', x: CW * 0.4, y: CH * 0.3, w: CH * 0.4, h: CH * 0.4, fill: '#f59e0b' }) },
                { label: 'Line', icon: Minus, onSelect: () => addEl({ kind: 'line', x: CW * 0.25, y: CH * 0.5 - 20, w: CW * 0.5, h: 40, stroke: '#ffffff', strokeWidth: 6 }) }
              ])
            }
          >
            Shape
          </Button>
          <Button
            size="sm"
            icon={Star}
            onClick={(e) =>
              openContextMenu(
                e,
                Object.entries(SLIDE_ICONS).map(([key, Icon]) => ({ label: key, icon: Icon, onSelect: () => addEl({ kind: 'icon', icon: key, x: CW / 2 - 100, y: CH / 2 - 100, w: 200, h: 200, fill: '#ffffff', strokeWidth: 1.5 }) }))
              )
            }
          >
            Icon
          </Button>
          <span className="mx-1 h-6 w-px bg-line" />
          <IconButton icon={AlignStartVertical} label="Align left" onClick={() => align('l')} disabled={!sel} />
          <IconButton icon={AlignCenterVertical} label="Centre horizontally" onClick={() => align('c')} disabled={!sel} />
          <IconButton icon={AlignEndVertical} label="Align right" onClick={() => align('r')} disabled={!sel} />
          <IconButton icon={AlignStartHorizontal} label="Align top" onClick={() => align('t')} disabled={!sel} />
          <IconButton icon={AlignCenterHorizontal} label="Centre vertically" onClick={() => align('m')} disabled={!sel} />
          <IconButton icon={AlignEndHorizontal} label="Align bottom" onClick={() => align('b')} disabled={!sel} />
          <span className="mx-1 h-6 w-px bg-line" />
          <IconButton icon={BringToFront} label="Bring to front" onClick={() => layer('front')} disabled={!sel} />
          <IconButton icon={SendToBack} label="Send to back" onClick={() => layer('back')} disabled={!sel} />
          <IconButton icon={Copy} label={`Duplicate (${comboLabel('Mod+KeyD')})`} onClick={duplicateSel} disabled={!sel} />
          <IconButton icon={Trash2} label={`Delete (${comboLabel(IS_MAC ? 'Backspace' : 'Delete')})`} onClick={removeSel} disabled={!sel} />
        </div>
        <span className="flex-1" />
        <div className="no-drag flex items-center gap-2">
          <Button size="sm" icon={BookMarked} onClick={(e) => void insertFromLibrary(e)}>From library</Button>
          <Button size="sm" onClick={() => void saveToLibrary()}>Save to library</Button>
          <Button onClick={() => void cancel()}>Cancel</Button>
          <Button variant="primary" onClick={done} data-testid="slide-editor-done">Done</Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 flex-col gap-2 overflow-auto border-r border-line bg-panel p-2">
          {slides.map((s, i) => (
            <div key={s.id} className="group relative">
              <button type="button" onClick={() => { setCurrent(i); setSelId(null) }} className={cx('w-full overflow-hidden rounded border-2', i === current ? 'border-accent' : 'border-line')}>
                <SlidePreview slide={render(s)} aspect={app.settings.presentation.aspectRatio} />
                <div className="truncate bg-panel-2 px-1.5 py-0.5 text-left text-[10px] text-muted">{i + 1}. {s.label}</div>
              </button>
              <div className="absolute top-1 right-1 hidden gap-0.5 group-hover:flex">
                <IconButton size="sm" variant="secondary" icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => { const a = [...slides]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; commit(a); setCurrent(i - 1) }} />
                <IconButton size="sm" variant="secondary" icon={ArrowDown} label="Move down" disabled={i === slides.length - 1} onClick={() => { const a = [...slides]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; commit(a); setCurrent(i + 1) }} />
                <IconButton size="sm" variant="secondary" icon={Copy} label="Duplicate slide" onClick={() => { const c = { ...structuredClone(s), id: crypto.randomUUID(), label: `${s.label} copy` }; const a = [...slides]; a.splice(i + 1, 0, c); commit(a); setCurrent(i + 1) }} />
                <IconButton size="sm" variant="secondary" icon={Trash2} label="Delete slide" disabled={slides.length === 1} onClick={() => { commit(slides.filter((_, k) => k !== i)); setCurrent(Math.max(0, i - 1)) }} />
              </div>
            </div>
          ))}
          <Button icon={Plus} onClick={() => { commit([...slides, newSlide(slides.length + 1)]); setCurrent(slides.length); setSelId(null) }}>Add slide</Button>
        </aside>

        <main className="flex min-h-0 items-center justify-center overflow-hidden bg-stage p-6" onPointerDown={() => setSelId(null)}>
          <div
            ref={stageRef}
            className="relative shadow-2xl"
            style={{ width: stageW, height: stageW * (CH / CW) }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div style={{ width: CW, height: CH, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'relative' }}>
                {slide && <SlideView slide={render(slide)} w={CW} h={CH} opts={{ live: false }} />}
              </div>
            </div>
            {/* interaction layer */}
            {slide?.elements.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => startDrag(e, el, 'move')}
                onDoubleClick={() => el.kind === 'text' && textRef.current?.focus()}
                className={cx('absolute', el.id === selId ? 'outline-2 outline-accent' : 'hover:outline hover:outline-accent/50', el.locked ? 'cursor-not-allowed' : 'cursor-move')}
                style={{ left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale, transform: `rotate(${el.rotation}deg)` }}
              >
                {el.id === selId && !el.locked && (
                  <>
                    {handles.map((h) => (
                      <span key={h} onPointerDown={(e) => startDrag(e, el, 'resize', h)} className="absolute h-2.5 w-2.5 rounded-sm border border-accent bg-white" style={handlePos[h]} />
                    ))}
                    <span onPointerDown={(e) => startDrag(e, el, 'rotate', 'rot')} className="absolute left-1/2 -ml-1.5 h-3 w-3 cursor-grab rounded-full border border-accent bg-white" style={{ top: -26 }} data-tip="Rotate (Shift snaps 15°)" />
                  </>
                )}
              </div>
            ))}
            {guides.x.map((x) => <div key={`gx${x}`} className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent" style={{ left: x * scale }} />)}
            {guides.y.map((y) => <div key={`gy${y}`} className="pointer-events-none absolute right-0 left-0 h-px bg-accent" style={{ top: y * scale }} />)}
          </div>
        </main>

        <aside className="min-h-0 overflow-auto border-l border-line bg-panel">
          {sel ? (
            <ElementProps el={sel} update={(p) => updateEl(sel.id, p)} textRef={textRef} onPickMedia={() => setPicker(sel.kind === 'video' ? 'video' : 'image')} />
          ) : slide ? (
            <>
              <Section title="Slide">
                <Field label="Name"><Input value={slide.label} onChange={(e) => updateSlide({ label: e.target.value })} /></Field>
                <Field label="Operator notes"><Textarea rows={2} value={slide.notes} onChange={(e) => updateSlide({ notes: e.target.value })} /></Field>
              </Section>
              <Section title="Background">
                <BackgroundOverride value={slide.background} onChange={(v) => updateSlide({ background: v })} inheritLabel="Use item / theme background" />
              </Section>
              <Section title="Layers">
                {slide.elements.length === 0 && <p className="text-[12px] text-dim">Add text, images, shapes or icons from the toolbar.</p>}
                {[...slide.elements].reverse().map((el) => (
                  <button key={el.id} type="button" onClick={() => setSelId(el.id)} className="flex items-center gap-2 rounded px-2 py-1 text-left text-[12px] hover:bg-panel-3">
                    <span className="w-12 text-dim">{el.kind}</span>
                    <span className="truncate">{el.kind === 'text' ? el.text : el.icon ?? el.shape ?? ''}</span>
                  </button>
                ))}
              </Section>
            </>
          ) : null}
        </aside>
      </div>
      <MediaPicker
        open={picker !== null}
        type={picker === 'video' ? 'video' : 'image'}
        onClose={() => setPicker(null)}
        onPick={(m) => {
          setPicker(null)
          if (sel && (sel.kind === 'image' || sel.kind === 'video') && sel.kind === m.type) return updateEl(sel.id, { mediaId: m.id })
          const ratio = m.width && m.height ? m.height / m.width : 9 / 16
          const w = CW * 0.5
          addEl({ kind: m.type === 'video' ? 'video' : 'image', mediaId: m.id, x: CW * 0.25, y: (CH - w * ratio) / 2, w, h: w * ratio, fit: 'cover', loop: true, muted: true })
        }}
      />
    </div>,
    document.body
  )
}

function ElementProps({ el, update, textRef, onPickMedia }: { el: SlideElement; update: (p: Partial<SlideElement>) => void; textRef: React.RefObject<HTMLTextAreaElement | null>; onPickMedia: () => void }) {
  const num = (k: 'x' | 'y' | 'w' | 'h' | 'rotation', label: string) => (
    <Field label={label}>
      <Input type="number" value={Math.round(el[k])} onChange={(e) => update({ [k]: Number(e.target.value) || 0 })} />
    </Field>
  )
  const style = { ...DEFAULT_TEXT_STYLE, ...el.style, shadow: { ...DEFAULT_TEXT_STYLE.shadow, ...el.style?.shadow }, outline: { ...DEFAULT_TEXT_STYLE.outline, ...el.style?.outline }, box: { ...DEFAULT_TEXT_STYLE.box, ...el.style?.box } }
  return (
    <>
      {el.kind === 'text' && (
        <Section title="Text">
          <Textarea ref={textRef} rows={4} value={el.text ?? ''} onChange={(e) => update({ text: e.target.value })} aria-label="Element text" />
          <TextStyleEditor value={style} onChange={(v) => update({ style: v })} />
        </Section>
      )}
      {(el.kind === 'image' || el.kind === 'video') && (
        <Section title={el.kind === 'image' ? 'Image' : 'Video'}>
          <Button onClick={onPickMedia}>Replace {el.kind}…</Button>
          <Segmented size="sm" value={el.fit ?? 'cover'} onChange={(v) => update({ fit: v })} options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'stretch', label: 'Stretch' }]} />
          <Field label="Corner radius"><Slider value={el.radius ?? 0} min={0} max={300} step={2} onChange={(v) => update({ radius: v })} format={(v) => `${v}`} /></Field>
          {el.kind === 'video' && (
            <div className="flex gap-4">
              <Toggle checked={el.loop ?? true} onChange={(v) => update({ loop: v })} label="Loop" />
              <Toggle checked={el.muted ?? true} onChange={(v) => update({ muted: v })} label="Muted" />
            </div>
          )}
        </Section>
      )}
      {(el.kind === 'shape' || el.kind === 'icon') && (
        <Section title={el.kind === 'icon' ? 'Icon' : 'Shape'}>
          <Field label="Fill / colour"><ColorInput value={el.fill ?? '#ffffff'} onChange={(v) => update({ fill: v })} /></Field>
          {el.kind === 'shape' && el.shape === 'rect' && <Field label="Corner radius"><Slider value={el.radius ?? 0} min={0} max={300} step={2} onChange={(v) => update({ radius: v })} format={(v) => `${v}`} /></Field>}
          {el.kind === 'shape' && el.shape !== 'triangle' && (
            <>
              <Field label="Border colour"><ColorInput value={el.stroke ?? '#000000'} onChange={(v) => update({ stroke: v })} /></Field>
              <Field label="Border width"><Slider value={el.strokeWidth ?? 0} min={0} max={40} step={1} onChange={(v) => update({ strokeWidth: v })} format={(v) => `${v}px`} /></Field>
            </>
          )}
          {el.kind === 'icon' && <Field label="Line weight"><Slider value={el.strokeWidth ?? 1.5} min={0.5} max={4} step={0.25} onChange={(v) => update({ strokeWidth: v })} format={(v) => String(v)} /></Field>}
        </Section>
      )}
      {el.kind === 'line' && (
        <Section title="Line">
          <Field label="Colour"><ColorInput value={el.stroke ?? '#ffffff'} onChange={(v) => update({ stroke: v })} /></Field>
          <Field label="Thickness"><Slider value={el.strokeWidth ?? 4} min={1} max={60} step={1} onChange={(v) => update({ strokeWidth: v })} format={(v) => `${v}px`} /></Field>
        </Section>
      )}
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-2">
          {num('x', 'X')}
          {num('y', 'Y')}
          {num('w', 'Width')}
          {num('h', 'Height')}
        </div>
        {num('rotation', 'Rotation (°)')}
        <Field label="Opacity"><Slider value={el.opacity} onChange={(v) => update({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Toggle checked={!!el.locked} onChange={(v) => update({ locked: v })} label="Lock position" />
      </Section>
    </>
  )
}
