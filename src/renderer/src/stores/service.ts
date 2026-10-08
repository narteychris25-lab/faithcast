import { create } from 'zustand'
import type { ItemInput, ServiceInput } from '@shared/ipc'
import type { ServiceItem, ServiceWithItems } from '@shared/types'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/overlays'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface ServiceState {
  service: ServiceWithItems | null
  loading: boolean
  selectedItemId: string | null
  status: SaveStatus
  lastSavedAt: number | null
  /** Pending debounced writes, keyed by item id or "service". */
  pending: Record<string, ReturnType<typeof setTimeout>>

  load: (id: string | null) => Promise<void>
  refresh: () => Promise<void>
  select: (id: string | null) => void
  updateService: (patch: Partial<ServiceInput>, debounce?: boolean) => void
  addItem: (item: ItemInput, position?: number) => Promise<ServiceItem | null>
  addItems: (items: ItemInput[], position?: number) => Promise<void>
  updateItem: (id: string, patch: Partial<ItemInput>, debounce?: boolean) => void
  deleteItem: (id: string) => Promise<void>
  duplicateItem: (id: string) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
  moveItem: (id: string, delta: number) => Promise<void>
  flush: () => void
}

/**
 * The service currently open in the planner / live view. Every change is
 * applied optimistically, then written to the database immediately (or after
 * a short debounce for typing). The save indicator reflects real write state.
 */
export const useService = create<ServiceState>((set, get) => {
  async function write<T>(fn: () => Promise<T>): Promise<T | null> {
    set({ status: 'saving' })
    try {
      const r = await fn()
      set({ status: Object.keys(get().pending).length ? 'unsaved' : 'saved', lastSavedAt: Date.now() })
      return r
    } catch (e) {
      set({ status: 'error' })
      toast.error(e)
      await get().refresh()
      return null
    }
  }

  function debounced(key: string, run: () => Promise<unknown>, delay: number) {
    const pending = { ...get().pending }
    clearTimeout(pending[key])
    pending[key] = setTimeout(() => {
      const p = { ...get().pending }
      delete p[key]
      set({ pending: p })
      void write(run)
    }, delay)
    set({ pending, status: 'unsaved' })
    void api('app:setUnsaved', true).catch(() => undefined)
  }

  return {
    service: null,
    loading: false,
    selectedItemId: null,
    status: 'saved',
    lastSavedAt: null,
    pending: {},

    async load(id) {
      get().flush()
      if (!id) {
        set({ service: null, selectedItemId: null })
        return
      }
      set({ loading: true })
      try {
        const service = await api('services:get', id)
        set({ service, loading: false, selectedItemId: service?.items[0]?.id ?? null, status: 'saved' })
      } catch (e) {
        set({ loading: false })
        toast.error(e)
      }
    },

    async refresh() {
      const id = get().service?.id
      if (!id) return
      const service = await api('services:get', id)
      set((s) => ({
        service,
        selectedItemId: service?.items.some((i) => i.id === s.selectedItemId) ? s.selectedItemId : (service?.items[0]?.id ?? null)
      }))
    },

    select: (id) => set({ selectedItemId: id }),

    updateService(patch, debounce = false) {
      const svc = get().service
      if (!svc) return
      set({ service: { ...svc, ...patch } as ServiceWithItems })
      const run = () => api('services:update', { id: svc.id, patch })
      if (debounce) debounced('service', run, 600)
      else void write(run)
    },

    async addItem(item, position) {
      const svc = get().service
      if (!svc) return null
      const created = await write(() => api('items:add', { serviceId: svc.id, item, position }))
      if (created) {
        await get().refresh()
        set({ selectedItemId: created.id })
      }
      return created
    },

    async addItems(items, position) {
      const svc = get().service
      if (!svc || !items.length) return
      let last: ServiceItem | null = null
      await write(async () => {
        for (let i = 0; i < items.length; i++) {
          last = await api('items:add', { serviceId: svc.id, item: items[i], position: position === undefined ? undefined : position + i })
        }
      })
      await get().refresh()
      if (last) set({ selectedItemId: (last as ServiceItem).id })
    },

    updateItem(id, patch, debounce = false) {
      const svc = get().service
      if (!svc) return
      set({
        service: { ...svc, items: svc.items.map((i) => (i.id === id ? ({ ...i, ...patch, data: patch.data ?? i.data } as ServiceItem) : i)) }
      })
      const run = () => api('items:update', { id, patch })
      if (debounce) debounced(id, run, 600)
      else void write(run)
    },

    async deleteItem(id) {
      const svc = get().service
      if (!svc) return
      const idx = svc.items.findIndex((i) => i.id === id)
      set({
        service: { ...svc, items: svc.items.filter((i) => i.id !== id) },
        selectedItemId: svc.items[idx + 1]?.id ?? svc.items[idx - 1]?.id ?? null
      })
      await write(() => api('items:delete', id))
    },

    async duplicateItem(id) {
      const created = await write(() => api('items:duplicate', id))
      await get().refresh()
      if (created) set({ selectedItemId: created.id })
    },

    async reorder(ids) {
      const svc = get().service
      if (!svc) return
      const byId = new Map(svc.items.map((i) => [i.id, i]))
      set({ service: { ...svc, items: ids.map((id, n) => ({ ...byId.get(id)!, position: n })) } })
      await write(() => api('items:reorder', { serviceId: svc.id, ids }))
    },

    async moveItem(id, delta) {
      const svc = get().service
      if (!svc) return
      const ids = svc.items.map((i) => i.id)
      const from = ids.indexOf(id)
      const to = Math.max(0, Math.min(ids.length - 1, from + delta))
      if (from < 0 || from === to) return
      ids.splice(to, 0, ids.splice(from, 1)[0])
      await get().reorder(ids)
    },

    /** Run pending debounced writes now (before navigation / close). */
    flush() {
      const pending = get().pending
      const svc = get().service
      if (!svc) return
      for (const [key, timer] of Object.entries(pending)) {
        clearTimeout(timer)
        if (key === 'service') void write(() => api('services:update', { id: svc.id, patch: svc }))
        else {
          const item = svc.items.find((i) => i.id === key)
          if (item) void write(() => api('items:update', { id: key, patch: { title: item.title, data: item.data, notes: item.notes } }))
        }
      }
      set({ pending: {} })
    }
  }
})

// Mirror save state to the main process so quitting with pending edits can warn.
useService.subscribe((s, prev) => {
  if (s.status !== prev.status && s.status === 'saved') void api('app:setUnsaved', false).catch(() => undefined)
})
