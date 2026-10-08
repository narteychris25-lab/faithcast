import { useEffect, useState, type KeyboardEvent } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Lock, Pencil, Play, Trash2, Unlock, TextCursorInput, ListPlus } from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { ServiceItem } from '@shared/types'
import { cx } from '@/lib/format'
import { DRAG_MIME, ITEM_META, itemSubtitle, mediaItemInput } from '@/lib/items'
import { api } from '@/lib/api'
import { useApp } from '@/stores/app'
import { useContent, useMediaItem } from '@/stores/content'
import { useService } from '@/stores/service'
import { useLive } from '@/stores/live'
import { EmptyState } from '@/components/ui/controls'
import { confirmDialog, openContextMenu, promptDialog, toast, type MenuEntry } from '@/components/ui/overlays'
import { IS_MAC, isMod, OS } from '@/lib/platform'
import { comboLabel } from '@/lib/shortcuts'

export interface ItemActions {
  edit: (item: ServiceItem) => void
}

function Row({ item, index, actions }: { item: ServiceItem; index: number; actions: ItemActions }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: item.locked })
  const selected = useService((s) => s.selectedItemId === item.id)
  const liveId = useLive((s) => s.itemId)
  const svc = useService()
  const song = useContent((s) => (item.refId ? s.songs[item.refId] : undefined))
  const translations = useApp((s) => s.translations)
  const media = useMediaItem(item.data.mediaId)
  const M = ITEM_META[item.type]
  const sub = itemSubtitle(item, {
    author: song?.author,
    translation: translations.find((t) => t.id === item.data.bible?.translationId)?.abbreviation,
    media: item.data.mediaId ? (media ? (media.missing ? 'Media file unavailable' : media.name) : '') : ''
  })

  useEffect(() => {
    if (item.type === 'song' && item.refId) void useContent.getState().loadSong(item.refId)
  }, [item.type, item.refId])

  const menu: MenuEntry[] = [
    { label: 'Preview', icon: Eye, onSelect: () => svc.select(item.id) },
    { label: 'Show live', icon: Play, onSelect: () => void useLive.getState().goLive(item) },
    { label: 'Edit…', icon: Pencil, onSelect: () => actions.edit(item), disabled: item.locked },
    {
      label: 'Rename…',
      icon: TextCursorInput,
      disabled: item.locked,
      onSelect: async () => {
        const t = await promptDialog({ title: 'Rename item', defaultValue: item.title })
        if (t) svc.updateItem(item.id, { title: t })
      }
    },
    'separator',
    { label: 'Move up', icon: ArrowUp, shortcut: comboLabel('Alt+ArrowUp'), disabled: index === 0 || item.locked, onSelect: () => void svc.moveItem(item.id, -1) },
    { label: 'Move down', icon: ArrowDown, shortcut: comboLabel('Alt+ArrowDown'), disabled: item.locked, onSelect: () => void svc.moveItem(item.id, 1) },
    { label: 'Duplicate', icon: Copy, shortcut: comboLabel('Mod+KeyD'), onSelect: () => void svc.duplicateItem(item.id) },
    { label: item.hidden ? 'Show in presentation' : 'Hide from presentation', icon: item.hidden ? Eye : EyeOff, onSelect: () => svc.updateItem(item.id, { hidden: !item.hidden }) },
    { label: item.locked ? 'Unlock' : 'Lock', icon: item.locked ? Unlock : Lock, onSelect: () => svc.updateItem(item.id, { locked: !item.locked }) },
    'separator',
    { label: 'Delete', icon: Trash2, danger: true, shortcut: comboLabel(IS_MAC ? 'Backspace' : 'Delete'), disabled: item.locked, onSelect: () => void deleteItem(item) }
  ]

  if (item.type === 'header') {
    return (
      <li
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        onClick={() => svc.select(item.id)}
        onContextMenu={(e) => openContextMenu(e, menu)}
        data-item-id={item.id}
        className={cx('group mt-2 flex h-8 items-center gap-2 rounded-md px-1', selected ? 'bg-accent/15' : 'hover:bg-panel-2', isDragging && 'z-10 opacity-60')}
      >
        <span {...attributes} {...listeners} className="cursor-grab text-dim opacity-0 group-hover:opacity-100" aria-label="Drag to reorder">
          <GripVertical size={14} />
        </span>
        <span className="text-[11px] font-bold tracking-[0.15em] text-muted uppercase">{item.title}</span>
        <span className="h-px flex-1 bg-line" />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => svc.select(item.id)}
      onDoubleClick={() => actions.edit(item)}
      onContextMenu={(e) => openContextMenu(e, menu)}
      data-item-id={item.id}
      className={cx(
        'group flex h-12 items-center gap-2 rounded-md border px-1.5',
        selected ? 'border-accent/60 bg-accent/15' : 'border-transparent hover:bg-panel-2',
        item.hidden && 'opacity-45',
        isDragging && 'z-10 bg-panel-3 opacity-80 shadow-xl'
      )}
    >
      <span {...attributes} {...listeners} className={cx('text-dim', item.locked ? 'cursor-not-allowed' : 'cursor-grab')} aria-label="Drag to reorder">
        <GripVertical size={15} />
      </span>
      <span className="w-5 text-right font-mono text-[11px] text-dim tabular-nums">{index + 1}</span>
      <M.icon size={16} className={cx('shrink-0', M.color)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate text-[13px] font-medium">
          {item.title}
          {liveId === item.id && <span className="rounded bg-live px-1 text-[9px] font-bold text-white">LIVE</span>}
        </div>
        <div className={cx('truncate text-[11px]', sub === 'Media file unavailable' ? 'text-danger' : 'text-dim')}>{sub || M.label}</div>
      </div>
      {item.hidden && <EyeOff size={13} className="text-dim" />}
      {item.locked && <Lock size={13} className="text-dim" />}
      <div className="hidden items-center gap-0.5 group-hover:flex">
        <IconBtn label="Move up" onClick={() => void svc.moveItem(item.id, -1)} icon={ArrowUp} disabled={item.locked} />
        <IconBtn label="Move down" onClick={() => void svc.moveItem(item.id, 1)} icon={ArrowDown} disabled={item.locked} />
        <IconBtn label="Duplicate" onClick={() => void svc.duplicateItem(item.id)} icon={Copy} />
        <IconBtn label={item.hidden ? 'Show' : 'Hide'} onClick={() => svc.updateItem(item.id, { hidden: !item.hidden })} icon={item.hidden ? Eye : EyeOff} />
        <IconBtn label={item.locked ? 'Unlock' : 'Lock'} onClick={() => svc.updateItem(item.id, { locked: !item.locked })} icon={item.locked ? Unlock : Lock} />
        <IconBtn label="Delete" onClick={() => void deleteItem(item)} icon={Trash2} disabled={item.locked} danger />
      </div>
    </li>
  )
}

function IconBtn({ label, icon: Icon, onClick, disabled, danger }: { label: string; icon: typeof Copy; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      data-tip={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cx('rounded p-1 text-muted hover:bg-panel-3 disabled:opacity-30', danger ? 'hover:text-danger' : 'hover:text-fg')}
    >
      <Icon size={13} />
    </button>
  )
}

export async function deleteItem(item: ServiceItem) {
  if (item.locked) return toast.info('Unlock the item before deleting it.')
  const ok = await confirmDialog({ title: `Delete “${item.title}”?`, message: 'It will be removed from this service. Songs and media stay in your library.', confirmLabel: 'Delete', danger: true })
  if (ok) await useService.getState().deleteItem(item.id)
}

/** Center column: the ordered, sortable service sequence. Accepts drops from the library and the file manager. */
export function ServiceList({ actions }: { actions: ItemActions }) {
  const service = useService((s) => s.service)
  const svc = useService()
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  if (!service) return null
  const items = service.items

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((i) => i.id === e.active.id)
    const to = items.findIndex((i) => i.id === e.over!.id)
    void svc.reorder(arrayMove(items, from, to).map((i) => i.id))
  }

  function indexAt(y: number, list: HTMLElement): number {
    const rows = [...list.querySelectorAll<HTMLElement>('[data-item-id]')]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) return i
    }
    return rows.length
  }

  async function onDrop(e: React.DragEvent<HTMLUListElement>) {
    e.preventDefault()
    const at = dropIndex ?? items.length
    setDropIndex(null)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (raw) {
      try {
        await svc.addItem(JSON.parse(raw) as ItemInput, at)
      } catch (err) {
        toast.error(err)
      }
      return
    }
    // Files dragged in from Finder / File Explorer: import to the library, then add.
    const paths = [...e.dataTransfer.files].map((f) => window.fc.pathForFile(f)).filter(Boolean)
    if (!paths.length) return
    const r = await api('media:import', { paths })
    if (r.errors.length) toast.warning(r.errors.slice(0, 3).join('\n'))
    useContent.getState().invalidateMedia()
    const media = await api('media:getMany', r.ids)
    const inputs: ItemInput[] = media.map((m) => mediaItemInput(m))
    await svc.addItems(inputs, at)
    if (inputs.length) toast.success(`Added ${inputs.length} media item${inputs.length === 1 ? '' : 's'}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const idx = items.findIndex((i) => i.id === svc.selectedItemId)
    const cur = items[idx]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.altKey && cur) return void svc.moveItem(cur.id, e.key === 'ArrowDown' ? 1 : -1)
      const next = items[Math.max(0, Math.min(items.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) svc.select(next.id)
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && cur) {
      e.preventDefault()
      void deleteItem(cur)
    } else if (e.key.toLowerCase() === 'd' && isMod(e) && cur) {
      e.preventDefault()
      void svc.duplicateItem(cur.id)
    } else if (e.key === 'Enter' && cur) {
      e.preventDefault()
      actions.edit(cur)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul
          tabIndex={0}
          aria-label="Service items"
          onKeyDown={onKeyDown}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DRAG_MIME) || e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setDropIndex(indexAt(e.clientY, e.currentTarget))
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null)
          }}
          onDrop={onDrop}
          className="relative flex min-h-full flex-col gap-0.5 p-2 focus:outline-none"
        >
          {items.map((item, i) => (
            <div key={item.id} className="relative">
              {dropIndex === i && <div className="absolute -top-0.5 right-2 left-2 h-0.5 rounded bg-accent" />}
              <Row item={item} index={i} actions={actions} />
            </div>
          ))}
          {dropIndex === items.length && items.length > 0 && <div className="mx-2 h-0.5 rounded bg-accent" />}
          {items.length === 0 && (
            <div className="flex-1">
              <EmptyState icon={ListPlus} title="This service is empty">
                Add songs, Bible passages, media and slides from the left panel — click to add, or drag them here. You can also drop files from {OS.fileManager}.
              </EmptyState>
            </div>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
