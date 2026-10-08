import type {
  Background,
  Service,
  ServiceItem,
  ServiceItemData,
  ServiceItemType,
  ServiceSummary,
  ServiceWithItems,
  Transition
} from '@shared/types'
import { bool, int, now, parseJson, type DB } from '../connection'

interface ServiceRow {
  id: string
  name: string
  date: string
  time: string
  notes: string
  theme_id: string | null
  background: string | null
  demo: number
  created_at: string
  updated_at: string
  opened_at: string | null
  item_count?: number
}

interface ItemRow {
  id: string
  service_id: string
  position: number
  type: ServiceItemType
  title: string
  ref_id: string | null
  data: string
  theme_id: string | null
  background: string | null
  transition: string | null
  hidden: number
  locked: number
  notes: string
  created_at: string
  updated_at: string
}

export interface ServiceInput {
  name: string
  date: string
  time?: string
  notes?: string
  themeId?: string | null
  background?: Background | null
  demo?: boolean
}

export interface ItemInput {
  type: ServiceItemType
  title: string
  refId?: string | null
  data?: ServiceItemData
  themeId?: string | null
  background?: Background | null
  transition?: Transition | null
  hidden?: boolean
  locked?: boolean
  notes?: string
}

export type ItemPatch = Partial<ItemInput>

const toService = (r: ServiceRow): ServiceSummary => ({
  id: r.id,
  name: r.name,
  date: r.date,
  time: r.time,
  notes: r.notes,
  themeId: r.theme_id,
  background: parseJson<Background | null>(r.background, null),
  demo: bool(r.demo),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  openedAt: r.opened_at,
  itemCount: r.item_count ?? 0
})

const toItem = (r: ItemRow): ServiceItem => ({
  id: r.id,
  serviceId: r.service_id,
  position: r.position,
  type: r.type,
  title: r.title,
  refId: r.ref_id,
  data: parseJson<ServiceItemData>(r.data, {}),
  themeId: r.theme_id,
  background: parseJson<Background | null>(r.background, null),
  transition: parseJson<Transition | null>(r.transition, null),
  hidden: bool(r.hidden),
  locked: bool(r.locked),
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

const SUMMARY_SQL = `SELECT s.*, r.opened_at,
  (SELECT COUNT(*) FROM service_items i WHERE i.service_id = s.id) AS item_count
  FROM services s LEFT JOIN recent_services r ON r.service_id = s.id`

export function createServiceRepo(db: DB) {
  const one = db.prepare<[string], ServiceRow>(`${SUMMARY_SQL} WHERE s.id = ?`)
  const items = db.prepare<[string], ItemRow>('SELECT * FROM service_items WHERE service_id = ? ORDER BY position')
  const item = db.prepare<[string], ItemRow>('SELECT * FROM service_items WHERE id = ?')
  const insertService = db.prepare(`INSERT INTO services
    (id, name, date, time, notes, theme_id, background, demo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertItem = db.prepare(`INSERT INTO service_items
    (id, service_id, position, type, title, ref_id, data, theme_id, background, transition, hidden, locked, notes, created_at, updated_at)
    VALUES (@id, @service_id, @position, @type, @title, @ref_id, @data, @theme_id, @background, @transition, @hidden, @locked, @notes, @created_at, @updated_at)`)
  const touch = db.prepare('UPDATE services SET updated_at = ? WHERE id = ?')
  const shift = db.prepare('UPDATE service_items SET position = position + 1 WHERE service_id = ? AND position >= ?')
  const setPos = db.prepare('UPDATE service_items SET position = ? WHERE id = ? AND service_id = ?')
  const maxPos = db.prepare<[string], { m: number | null }>('SELECT MAX(position) m FROM service_items WHERE service_id = ?')
  const markOpened = db.prepare(`INSERT INTO recent_services (service_id, opened_at) VALUES (?, ?)
    ON CONFLICT(service_id) DO UPDATE SET opened_at = excluded.opened_at`)

  const renumber = (serviceId: string) => {
    items.all(serviceId).forEach((r, i) => {
      if (r.position !== i) setPos.run(i, r.id, serviceId)
    })
  }

  const repo = {
    list(): ServiceSummary[] {
      return (db.prepare(`${SUMMARY_SQL} ORDER BY s.date DESC, s.updated_at DESC`).all() as ServiceRow[]).map(toService)
    },
    recent(limit = 8): ServiceSummary[] {
      return (
        db
          .prepare(`${SUMMARY_SQL} ORDER BY COALESCE(r.opened_at, s.updated_at) DESC LIMIT ?`)
          .all(limit) as ServiceRow[]
      ).map(toService)
    },
    onDate(date: string): ServiceSummary[] {
      return (db.prepare(`${SUMMARY_SQL} WHERE s.date = ? ORDER BY s.time`).all(date) as ServiceRow[]).map(toService)
    },
    upcoming(after: string, limit = 8): ServiceSummary[] {
      return (
        db.prepare(`${SUMMARY_SQL} WHERE s.date > ? ORDER BY s.date, s.time LIMIT ?`).all(after, limit) as ServiceRow[]
      ).map(toService)
    },
    get(id: string): ServiceWithItems | null {
      const r = one.get(id)
      if (!r) return null
      const { itemCount: _c, ...svc } = toService(r)
      return { ...svc, items: items.all(id).map(toItem) }
    },
    create(input: ServiceInput, id: string = crypto.randomUUID()): ServiceWithItems {
      const t = now()
      insertService.run(
        id,
        input.name.trim() || 'Untitled service',
        input.date,
        input.time ?? '',
        input.notes ?? '',
        input.themeId ?? null,
        input.background ? JSON.stringify(input.background) : null,
        int(!!input.demo),
        t,
        t
      )
      return repo.get(id)!
    },
    update(id: string, patch: Partial<ServiceInput>): Service {
      const cur = repo.get(id)
      if (!cur) throw new Error('Service not found')
      db.prepare(
        'UPDATE services SET name=?, date=?, time=?, notes=?, theme_id=?, background=?, updated_at=? WHERE id=?'
      ).run(
        patch.name !== undefined ? patch.name.trim() || cur.name : cur.name,
        patch.date ?? cur.date,
        patch.time ?? cur.time,
        patch.notes ?? cur.notes,
        patch.themeId !== undefined ? patch.themeId : cur.themeId,
        patch.background !== undefined ? (patch.background ? JSON.stringify(patch.background) : null) : cur.background ? JSON.stringify(cur.background) : null,
        now(),
        id
      )
      return repo.get(id)!
    },
    delete(id: string): void {
      db.prepare('DELETE FROM services WHERE id = ?').run(id)
    },
    duplicate(id: string, name?: string, date?: string): ServiceWithItems {
      const src = repo.get(id)
      if (!src) throw new Error('Service not found')
      return db.transaction(() => {
        const copy = repo.create({
          name: name ?? `${src.name} (Copy)`,
          date: date ?? src.date,
          time: src.time,
          notes: src.notes,
          themeId: src.themeId,
          background: src.background
        })
        for (const it of src.items) repo.addItem(copy.id, it)
        return repo.get(copy.id)!
      })()
    },
    markOpened(id: string): void {
      markOpened.run(id, now())
    },

    // ---------------------------------------------------------- items

    getItem(id: string): ServiceItem | null {
      const r = item.get(id)
      return r ? toItem(r) : null
    },
    addItem(serviceId: string, input: ItemInput, position?: number): ServiceItem {
      const t = now()
      const id = crypto.randomUUID()
      db.transaction(() => {
        const end = (maxPos.get(serviceId)?.m ?? -1) + 1
        const pos = position === undefined || position > end ? end : Math.max(0, position)
        if (pos < end) shift.run(serviceId, pos)
        insertItem.run({
          id,
          service_id: serviceId,
          position: pos,
          type: input.type,
          title: input.title.trim() || input.type,
          ref_id: input.refId ?? null,
          data: JSON.stringify(input.data ?? {}),
          theme_id: input.themeId ?? null,
          background: input.background ? JSON.stringify(input.background) : null,
          transition: input.transition ? JSON.stringify(input.transition) : null,
          hidden: int(!!input.hidden),
          locked: int(!!input.locked),
          notes: input.notes ?? '',
          created_at: t,
          updated_at: t
        })
        touch.run(t, serviceId)
      })()
      return repo.getItem(id)!
    },
    updateItem(id: string, patch: ItemPatch): ServiceItem {
      const cur = repo.getItem(id)
      if (!cur) throw new Error('Service item not found')
      // Locked items only allow toggling lock/hidden.
      if (cur.locked && Object.keys(patch).some((k) => k !== 'locked' && k !== 'hidden')) {
        throw new Error('This item is locked. Unlock it to make changes.')
      }
      const t = now()
      const json = <T>(v: T | null | undefined, fallback: T | null) =>
        v === undefined ? (fallback ? JSON.stringify(fallback) : null) : v ? JSON.stringify(v) : null
      db.transaction(() => {
        db.prepare(`UPDATE service_items SET title=?, ref_id=?, data=?, theme_id=?, background=?, transition=?,
          hidden=?, locked=?, notes=?, updated_at=? WHERE id=?`).run(
          patch.title !== undefined ? patch.title.trim() || cur.title : cur.title,
          patch.refId !== undefined ? patch.refId : cur.refId,
          JSON.stringify(patch.data ?? cur.data),
          patch.themeId !== undefined ? patch.themeId : cur.themeId,
          json(patch.background, cur.background),
          json(patch.transition, cur.transition),
          int(patch.hidden ?? cur.hidden),
          int(patch.locked ?? cur.locked),
          patch.notes ?? cur.notes,
          t,
          id
        )
        touch.run(t, cur.serviceId)
      })()
      return repo.getItem(id)!
    },
    deleteItem(id: string): void {
      const cur = repo.getItem(id)
      if (!cur) return
      db.transaction(() => {
        db.prepare('DELETE FROM service_items WHERE id = ?').run(id)
        renumber(cur.serviceId)
        touch.run(now(), cur.serviceId)
      })()
    },
    duplicateItem(id: string): ServiceItem {
      const cur = repo.getItem(id)
      if (!cur) throw new Error('Service item not found')
      return repo.addItem(cur.serviceId, { ...cur, title: `${cur.title} (Copy)`, locked: false }, cur.position + 1)
    },
    /** Set item order from a full list of ids (ids not in the list keep relative order at the end). */
    reorder(serviceId: string, orderedIds: string[]): ServiceItem[] {
      db.transaction(() => {
        const existing = items.all(serviceId).map((r) => r.id)
        const known = new Set(existing)
        const order = orderedIds.filter((i) => known.has(i))
        const rest = existing.filter((i) => !order.includes(i))
        ;[...order, ...rest].forEach((itemId, i) => setPos.run(i, itemId, serviceId))
        touch.run(now(), serviceId)
      })()
      return items.all(serviceId).map(toItem)
    },
    count: (): number => (db.prepare('SELECT COUNT(*) c FROM services').get() as { c: number }).c
  }
  return repo
}
