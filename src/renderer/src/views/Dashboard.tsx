import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, CircleHelp, Copy, FolderOpen, Image as ImageIcon, Megaphone, MonitorPlay, Music, Palette, Plus, Settings, Sparkles, Trash2, Upload, Zap, type LucideIcon } from 'lucide-react'
import type { DashboardData, MediaItem, ServiceSummary } from '@shared/types'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { api } from '@/lib/api'
import { longDate, relativeTime, shortDate } from '@/lib/format'
import { useApp, type View } from '@/stores/app'
import { useLive } from '@/stores/live'
import { Badge, Button, EmptyState, Field, Input, Panel, Spinner, Textarea } from '@/components/ui/controls'
import { Modal, confirmDialog, openContextMenu, promptDialog, toast } from '@/components/ui/overlays'
import { MediaPicker } from '@/components/editors'
import { createService } from './planner/Planner'
import { quickItem } from './songs/SongsView'

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const { openService, navigate, church } = useApp()
  const [quickMedia, setQuickMedia] = useState(false)
  const [quickAnn, setQuickAnn] = useState(false)
  const reload = () => void api('dashboard:get').then(setData).catch(toast.error)
  useEffect(reload, [])

  async function importService() {
    const svc = await api('services:import', null).catch((e) => toast.error(e))
    if (svc) {
      toast.success(`Imported “${svc.name}”`)
      openService(svc.id)
    }
  }

  async function loadDemo() {
    const r = await api('app:loadDemo').catch((e) => toast.error(e))
    if (!r) return
    toast.success('Demo content added — look for the DEMO labels.')
    await useApp.getState().reloadThemes()
    reload()
  }

  async function remove(s: ServiceSummary) {
    if (!(await confirmDialog({ title: `Delete “${s.name}”?`, message: 'This permanently removes the service and its items.', danger: true, confirmLabel: 'Delete' }))) return
    await api('services:delete', s.id)
    if (useApp.getState().currentServiceId === s.id) useApp.setState({ currentServiceId: null })
    reload()
  }

  async function duplicate(s: ServiceSummary) {
    const name = await promptDialog({ title: 'Duplicate service', defaultValue: `${s.name} (Copy)` })
    if (!name) return
    const copy = await api('services:duplicate', { id: s.id, name })
    openService(copy.id)
  }

  if (!data) return <div className="flex h-full items-center justify-center"><Spinner /></div>

  const presentMedia = (m: MediaItem) => {
    setQuickMedia(false)
    if (m.type === 'audio') {
      toast.info('Audio plays from a service item. Add it to a service, then play it from the Live view.')
      return
    }
    void useLive.getState().presentQuick(quickItem({ type: m.type, title: m.name, data: { mediaId: m.id, media: { ...DEFAULT_MEDIA_SETTINGS, fit: m.type === 'image' ? 'cover' : 'contain' } } }))
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-semibold">{church.name ? `Welcome, ${church.name}` : 'Dashboard'}</h1>
            <p className="text-[12px] text-muted">{longDate(new Date().toISOString().slice(0, 10))}</p>
          </div>
          <span className="flex-1" />
          <Button icon={Upload} onClick={() => void importService()}>Import service</Button>
          <Button icon={FolderOpen} onClick={() => navigate('planner')}>Open service</Button>
          <Button variant="primary" icon={Plus} onClick={() => void createService()} data-testid="new-service">New service</Button>
        </div>

        {data.today.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-live/40 bg-gradient-to-r from-live/15 to-transparent p-4">
            <CalendarDays className="text-live" />
            <div className="flex-1">
              <div className="text-[11px] font-bold tracking-wider text-live uppercase">Today's service</div>
              <div className="text-base font-semibold">{data.today[0].name}</div>
              <div className="text-[12px] text-muted">{data.today[0].time && `${data.today[0].time} · `}{data.today[0].itemCount} items</div>
            </div>
            <Button onClick={() => openService(data.today[0].id)}>Plan</Button>
            <Button variant="live" icon={MonitorPlay} onClick={() => openService(data.today[0].id, 'live')}>Go live</Button>
          </div>
        )}

        <div className="grid grid-cols-6 gap-3">
          {(
            [
              ['songs', 'Songs', Music, data.counts.songs],
              ['bible', 'Bible', BookOpen, data.counts.translations],
              ['media', 'Media', ImageIcon, data.counts.media],
              ['themes', 'Themes', Palette, data.counts.themes],
              ['settings', 'Settings', Settings, null],
              ['help', 'Help', CircleHelp, null]
            ] as [View, string, LucideIcon, number | null][]
          ).map(([view, label, Icon, n]) => (
            <button key={view} type="button" onClick={() => navigate(view)} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-left hover:border-line-strong hover:bg-panel-2">
              <Icon size={18} className="text-accent" />
              <div className="text-[13px] font-medium">{label}</div>
              <div className="text-[11px] text-dim">{n === null ? ' ' : view === 'bible' ? `${n} translation${n === 1 ? '' : 's'}` : `${n} item${n === 1 ? '' : 's'}`}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <div className="flex flex-col gap-4">
            <ServiceList title="Recent services" services={data.recent} onOpen={openService} onDelete={remove} onDuplicate={duplicate} empty={<EmptyState icon={CalendarDays} title="No services yet" action={<div className="flex gap-2"><Button variant="primary" icon={Plus} onClick={() => void createService()}>Create a service</Button><Button icon={Sparkles} onClick={() => void loadDemo()}>Load demo content</Button></div>}>Plan your first service, or load clearly-labelled demo content to explore.</EmptyState>} />
            {data.upcoming.some((u) => !data.recent.some((r) => r.id === u.id)) && (
              <ServiceList title="Scheduled" services={data.upcoming.filter((u) => !data.recent.some((r) => r.id === u.id))} onOpen={openService} onDelete={remove} onDuplicate={duplicate} />
            )}
          </div>
          <div className="flex flex-col gap-4">
            <Panel title={<span className="flex items-center gap-1.5"><Zap size={12} /> Quick presentation</span>}>
              <div className="flex flex-col gap-1.5 p-3">
                <p className="mb-1 text-[12px] text-muted">Put something on screen right now, without building a service.</p>
                <Button icon={Music} className="justify-start" onClick={() => navigate('songs')}>Present a song…</Button>
                <Button icon={BookOpen} className="justify-start" onClick={() => navigate('bible')}>Present a Bible passage…</Button>
                <Button icon={ImageIcon} className="justify-start" onClick={() => setQuickMedia(true)}>Present an image or video…</Button>
                <Button icon={Megaphone} className="justify-start" onClick={() => setQuickAnn(true)}>Present an announcement…</Button>
              </div>
            </Panel>
            <Panel title="Getting started">
              <div className="flex flex-col gap-1.5 p-3 text-[12px] text-muted">
                <Button icon={Sparkles} className="justify-start" onClick={() => void loadDemo()}>Load demo content</Button>
                <Button icon={CircleHelp} className="justify-start" onClick={() => navigate('help', 'projector')}>Connecting a projector</Button>
                <Button icon={CircleHelp} className="justify-start" onClick={() => navigate('help', 'shortcuts')}>Keyboard shortcuts</Button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <MediaPicker open={quickMedia} onClose={() => setQuickMedia(false)} onPick={presentMedia} />
      <QuickAnnouncement open={quickAnn} onClose={() => setQuickAnn(false)} />
    </div>
  )
}

function QuickAnnouncement({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [a, setA] = useState({ title: '', description: '', date: '', time: '', location: '' })
  const go = () => {
    onClose()
    void useLive.getState().presentQuick(quickItem({ type: 'announcement', title: a.title || 'Announcement', data: { announcement: { ...a, imageMediaId: null } } }))
  }
  return (
    <Modal open={open} onClose={onClose} title="Quick announcement" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="live" icon={MonitorPlay} onClick={go} disabled={!a.title}>Present</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Title"><Input autoFocus value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="YOUTH SERVICE" /></Field>
        <Field label="Description"><Textarea rows={2} value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date"><Input value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} placeholder="Friday" /></Field>
          <Field label="Time"><Input value={a.time} onChange={(e) => setA({ ...a, time: e.target.value })} placeholder="6:00 PM" /></Field>
          <Field label="Location"><Input value={a.location} onChange={(e) => setA({ ...a, location: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  )
}

function ServiceList({ title, services, onOpen, onDelete, onDuplicate, empty }: { title: string; services: ServiceSummary[]; onOpen: (id: string, view?: View) => void; onDelete: (s: ServiceSummary) => void; onDuplicate: (s: ServiceSummary) => void; empty?: React.ReactNode }) {
  return (
    <Panel title={title}>
      {services.length === 0 ? (
        <div className="h-56">{empty}</div>
      ) : (
        <ul className="divide-y divide-line">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-panel-2"
              onDoubleClick={() => onOpen(s.id)}
              onContextMenu={(e) =>
                openContextMenu(e, [
                  { label: 'Open in planner', icon: FolderOpen, onSelect: () => onOpen(s.id) },
                  { label: 'Present', icon: MonitorPlay, onSelect: () => onOpen(s.id, 'live') },
                  { label: 'Duplicate…', icon: Copy, onSelect: () => onDuplicate(s) },
                  'separator',
                  { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(s) }
                ])
              }
            >
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-panel-3 leading-none">
                <span className="text-[9px] font-bold text-live uppercase">{shortDate(s.date).split(' ')[0].replace(',', '')}</span>
                <span className="text-[15px] font-semibold">{Number(s.date.slice(8, 10))}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate font-medium">
                  {s.name} {s.demo && <Badge tone="demo">Demo</Badge>}
                </div>
                <div className="text-[12px] text-muted">
                  {longDate(s.date)} · {s.itemCount} items · modified {relativeTime(s.updatedAt)}
                </div>
              </div>
              <Button size="sm" onClick={() => onOpen(s.id)}>Open</Button>
              <Button size="sm" variant="ghost" icon={MonitorPlay} onClick={() => onOpen(s.id, 'live')} tip="Present" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
