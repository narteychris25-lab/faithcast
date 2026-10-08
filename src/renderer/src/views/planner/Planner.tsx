import { useEffect, useState } from 'react'
import { CalendarDays, Copy, Download, FileText, MonitorPlay, MoreHorizontal, Plus, Settings2, Trash2, FolderOpen } from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { ServiceItem, ServiceSummary } from '@shared/types'
import { api } from '@/lib/api'
import { longDate, nextSundayISO, relativeTime } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useService } from '@/stores/service'
import { useLive } from '@/stores/live'
import { Badge, Button, EmptyState, Input } from '@/components/ui/controls'
import { confirmDialog, openContextMenu, promptDialog, toast } from '@/components/ui/overlays'
import { SaveIndicator } from '@/components/SaveIndicator'
import { SlideEditor } from '@/views/slide-editor/SlideEditor'
import { Library } from './Library'
import { ServiceList } from './ServiceList'
import { ItemProperties } from './ItemProperties'

export async function createService(openIn: 'planner' | 'live' = 'planner'): Promise<void> {
  const name = await promptDialog({ title: 'New service', defaultValue: 'Sunday Service', confirmLabel: 'Create' })
  if (!name) return
  try {
    const svc = await api('services:create', { name, date: nextSundayISO() })
    useApp.getState().openService(svc.id, openIn)
  } catch (e) {
    toast.error(e)
  }
}

export async function exportService(id: string) {
  const includeMedia = await confirmDialog({
    title: 'Include media files?',
    message: 'Including media makes the package work on another computer, but the file will be larger. Choose Cancel to export without media.',
    confirmLabel: 'Include media'
  })
  const file = await api('services:export', { id, includeMedia }).catch((e) => toast.error(e))
  if (file) toast.success(`Exported to ${file}`)
}

export function Planner() {
  const serviceId = useApp((s) => s.currentServiceId)
  const service = useService((s) => s.service)
  const loading = useService((s) => s.loading)
  const svc = useService()
  const navigate = useApp((s) => s.navigate)
  const [editing, setEditing] = useState<ServiceItem | null>(null)

  useEffect(() => {
    if (serviceId && service?.id !== serviceId) void useService.getState().load(serviceId)
  }, [serviceId, service?.id])

  if (!serviceId || (!service && !loading)) return <ServiceChooser />
  if (!service) return null

  const selected = service.items.find((i) => i.id === svc.selectedItemId)
  const insertAt = selected ? selected.position + 1 : undefined
  const add = async (items: ItemInput[]) => {
    if (items.length === 1) await svc.addItem(items[0], insertAt)
    else await svc.addItems(items, insertAt)
  }

  const edit = (item: ServiceItem) => {
    if (item.locked) return toast.info('Unlock the item to edit it.')
    if (item.type === 'song' && item.refId) navigate('songs', item.refId)
    else if (item.type === 'custom') setEditing(item)
    else svc.select(item.id)
  }

  const more = (e: React.MouseEvent) =>
    openContextMenu(e, [
      {
        label: 'Duplicate service…',
        icon: Copy,
        onSelect: async () => {
          const name = await promptDialog({ title: 'Duplicate service', defaultValue: `${service.name} (Copy)` })
          if (!name) return
          const copy = await api('services:duplicate', { id: service.id, name, date: nextSundayISO() })
          useApp.getState().openService(copy.id)
        }
      },
      { label: 'Export package (.churchservice)…', icon: Download, onSelect: () => void exportService(service.id) },
      { label: 'Export order of service (TXT)…', icon: FileText, onSelect: () => void api('services:exportText', { id: service.id, format: 'txt' }).then((f) => f && toast.success('Exported')) },
      { label: 'Export as CSV…', icon: FileText, onSelect: () => void api('services:exportText', { id: service.id, format: 'csv' }).then((f) => f && toast.success('Exported')) },
      { label: 'Export as JSON…', icon: FileText, onSelect: () => void api('services:exportText', { id: service.id, format: 'json' }).then((f) => f && toast.success('Exported')) },
      'separator',
      { label: 'Open another service…', icon: FolderOpen, onSelect: () => navigate('dashboard') },
      'separator',
      {
        label: 'Delete service…',
        icon: Trash2,
        danger: true,
        onSelect: async () => {
          if (!(await confirmDialog({ title: `Delete “${service.name}”?`, message: 'This cannot be undone (unless you restore a backup).', danger: true, confirmLabel: 'Delete' }))) return
          await api('services:delete', service.id)
          useService.setState({ service: null })
          useApp.setState({ currentServiceId: null })
          navigate('dashboard')
        }
      }
    ])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate text-[15px] font-semibold">
            {service.name} {service.demo && <Badge tone="demo">Demo</Badge>}
          </div>
          <div className="text-[11px] text-muted">
            {longDate(service.date)}
            {service.time && ` · ${service.time}`} · {service.items.length} items
          </div>
        </div>
        <SaveIndicator />
        <span className="flex-1" />
        <Button icon={Settings2} variant={selected ? 'ghost' : 'secondary'} onClick={() => svc.select(null)} tip="Name, date, theme and background for the whole service">
          Service settings
        </Button>
        <Button
          variant="live"
          icon={MonitorPlay}
          onClick={async () => {
            navigate('live')
            if (!useApp.getState().output.open) await useLive.getState().startOutput()
          }}
        >
          Present
        </Button>
        <button type="button" onClick={more} className="rounded-md p-2 text-muted hover:bg-panel-3 hover:text-fg" aria-label="More service actions" data-tip="More">
          <MoreHorizontal size={16} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
          <Library onAdd={(items) => void add(items)} />
        </aside>
        <main className="min-h-0 overflow-auto" onClick={(e) => e.target === e.currentTarget && svc.select(null)}>
          <ServiceList actions={{ edit }} />
        </main>
        <aside className="flex min-h-0 flex-col border-l border-line bg-panel">
          <ItemProperties onEditSlides={setEditing} />
        </aside>
      </div>
      {editing && (
        <SlideEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(slides) => {
            svc.updateItem(editing.id, { data: { ...editing.data, slides } })
            if (useLive.getState().itemId === editing.id) setTimeout(() => void useLive.getState().refreshLive(), 300)
          }}
        />
      )}
    </div>
  )
}

/** Shown when no service is open. */
export function ServiceChooser() {
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [q, setQ] = useState('')
  const openService = useApp((s) => s.openService)
  useEffect(() => void api('services:list').then(setServices).catch(toast.error), [])
  const list = services.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Open a service</h1>
        <span className="flex-1" />
        <Button variant="primary" icon={Plus} onClick={() => void createService()}>
          New service
        </Button>
      </div>
      <Input placeholder="Filter services" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-panel">
        {list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No services">
            Create your first service to start planning.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => openService(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2">
                  <CalendarDays size={16} className="text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {s.name} {s.demo && <Badge tone="demo">Demo</Badge>}
                    </div>
                    <div className="text-[12px] text-muted">
                      {longDate(s.date)} · {s.itemCount} items · modified {relativeTime(s.updatedAt)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
