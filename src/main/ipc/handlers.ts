import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron'
import { existsSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { IpcArg, IpcChannel, IpcResult, ImportResult, FileFilterKind } from '@shared/ipc'
import type { BibleImportResult, LiveState, ThemeSettings } from '@shared/types'
import { BRAND } from '@shared/brand'
import { MEDIA_EXTENSIONS } from '../media/types'
import { checkMissing, deleteThumbnail, importMedia, makeThumbnail, saveThumbnailData } from '../media/importer'
import { listDisplays, identifyDisplays } from '../windows/displays'
import { createBackupSync, listBackups, pruneBackups, validateBackup } from '../backup'
import { exportTheme, importThemeFile } from '../io/themes'
import { parseSongFile, safeFileName, songFileContent, songsToCsv, songToText, writeSongsToDir } from '../io/songs'
import { exportServicePackage, exportServiceText, importServicePackage } from '../io/services'
import { readBibleFileDetailed } from '../io/bible'
import { installLibraryBible, listBibleLibrary } from '../io/bible-library'
import { saveWebCapture, saveWebMedia } from '../web'
import {
  ChurchSchema,
  CustomSlideSchema,
  ItemInputSchema,
  parse,
  ServiceInputSchema,
  SongInputSchema,
  ThemeSettingsSchema,
  z
} from '../validation'
import { paths } from '../paths'
import { log } from '../log'
import type { AppContext } from '../context'

const idArg = z.string().min(1).max(100)
const MAX_LIVE_PAYLOAD = 2 * 1024 * 1024

const FILTERS: Record<FileFilterKind, Electron.FileFilter[]> = {
  media: [{ name: 'Media', extensions: [...MEDIA_EXTENSIONS.image, ...MEDIA_EXTENSIONS.video, ...MEDIA_EXTENSIONS.audio] }],
  image: [{ name: 'Images', extensions: MEDIA_EXTENSIONS.image }],
  video: [{ name: 'Videos', extensions: MEDIA_EXTENSIONS.video }],
  audio: [{ name: 'Audio', extensions: MEDIA_EXTENSIONS.audio }],
  song: [{ name: 'Songs', extensions: ['song', 'txt', 'json', 'xml'] }],
  service: [{ name: 'Service packages', extensions: [BRAND.fileExtensions.service] }],
  theme: [{ name: 'Themes', extensions: [BRAND.fileExtensions.theme] }],
  bible: [{ name: 'Bibles (FaithCast, thiagobodruk JSON/XML, Zefania XML, CSV)', extensions: ['fcbible', BRAND.legacy.bibleExtension, 'json', 'xml', 'csv', 'gz'] }],
  backup: [{ name: 'FaithCast backups', extensions: ['db'] }]
}

export function registerIpc(ctx: AppContext): void {
  const { repos } = ctx

  function isTrusted(e: IpcMainInvokeEvent): boolean {
    const url = e.senderFrame?.url ?? ''
    const dev = process.env['ELECTRON_RENDERER_URL']
    return url.startsWith('file://') || (!!dev && url.startsWith(dev))
  }

  function handle<C extends IpcChannel>(
    channel: C,
    fn: (arg: IpcArg<C>, e: IpcMainInvokeEvent) => IpcResult<C> | Promise<IpcResult<C>>
  ): void {
    ipcMain.handle(channel, async (e, arg) => {
      if (!isTrusted(e)) return { ok: false, error: 'Untrusted sender' }
      try {
        return { ok: true, value: await fn(arg as IpcArg<C>, e) }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.warn(`ipc ${channel} failed:`, message)
        return { ok: false, error: message }
      }
    })
  }

  const win = (e: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender) ?? undefined

  async function pickFiles(e: IpcMainInvokeEvent, kind: FileFilterKind, multiple = true): Promise<string[]> {
    const props: ('openFile' | 'multiSelections' | 'openDirectory')[] = ['openFile']
    if (multiple) props.push('multiSelections')
    const w = win(e)
    const opts = { properties: props, filters: FILTERS[kind] }
    const r = w ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? [] : r.filePaths
  }

  async function pickSave(e: IpcMainInvokeEvent, defaultName: string, ext: string): Promise<string | null> {
    const w = win(e)
    const opts = { defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }
    const r = w ? await dialog.showSaveDialog(w, opts) : await dialog.showSaveDialog(opts)
    return r.canceled || !r.filePath ? null : r.filePath
  }

  async function pickDir(e: IpcMainInvokeEvent): Promise<string | null> {
    const w = win(e)
    const opts = { properties: ['openDirectory' as const, 'createDirectory' as const] }
    const r = w ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : r.filePaths[0]
  }

  const validPaths = (list: unknown): string[] =>
    parse(z.array(z.string().min(1).max(4096)).max(5000), list, 'file list').filter((p) => existsSync(p))

  // ------------------------------------------------------------- app
  handle('app:info', () => ({
    name: BRAND.name,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    dataDir: paths.root(),
    dbPath: paths.database(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    isPackaged: app.isPackaged
  }))
  handle('app:recovery', () => ctx.recovery())
  handle('app:clearRecovery', () => ctx.clearRecovery())
  handle('app:openExternal', async (url) => {
    const u = parse(z.string().max(2000), url)
    if (!/^(https?:|mailto:)/i.test(u)) throw new Error('Only web and email links can be opened')
    await shell.openExternal(u)
  })
  handle('app:showInFolder', (p) => {
    const file = parse(z.string().max(4096), p)
    if (existsSync(file)) shell.showItemInFolder(file)
  })
  handle('app:titleBar', (a) => {
    const color = z.string().regex(/^#[0-9a-f]{3,8}$/i)
    const p = parse(z.object({ color, symbolColor: color, height: z.number().int().min(24).max(120) }), a)
    const w = ctx.operator()
    if (process.platform !== 'darwin' && w && !w.isDestroyed()) w.setTitleBarOverlay(p)
  })
  handle('app:popupMenu', (a) => {
    const p = parse(z.object({ x: z.number().int().min(0).max(20000), y: z.number().int().min(0).max(20000) }), a)
    const w = ctx.operator()
    if (w && !w.isDestroyed()) Menu.getApplicationMenu()?.popup({ window: w, x: p.x, y: p.y })
  })
  handle('app:relaunch', () => {
    app.relaunch()
    app.quit()
  })
  handle('app:setUnsaved', (v) => ctx.setUnsaved(!!v))
  handle('app:loadDemo', () => ctx.loadDemo())
  handle('app:removeDemo', () => ctx.removeDemo())

  handle('dashboard:get', () => repos.dashboard())
  handle('search:global', (q) => repos.search(parse(z.string().max(200), q)))

  // ------------------------------------------------------------- church & settings
  handle('church:get', () => repos.settings.getChurch())
  handle('church:save', (patch) => repos.settings.saveChurch(parse(ChurchSchema, patch, 'church profile') as never))
  handle('settings:get', () => repos.settings.get())
  handle('settings:save', (patch) => {
    if (!patch || typeof patch !== 'object') throw new Error('Invalid settings')
    const next = repos.settings.save(patch)
    ctx.onSettingsChanged(next)
    return next
  })

  // ------------------------------------------------------------- themes
  handle('themes:list', () => repos.themes.list())
  handle('themes:create', (a) =>
    repos.themes.create(parse(z.string().max(200), a.name), parse(ThemeSettingsSchema, a.settings, 'theme') as ThemeSettings)
  )
  handle('themes:update', (a) =>
    repos.themes.update(parse(idArg, a.id), {
      name: a.name !== undefined ? parse(z.string().max(200), a.name) : undefined,
      settings: a.settings ? (parse(ThemeSettingsSchema, a.settings, 'theme') as ThemeSettings) : undefined
    })
  )
  handle('themes:duplicate', (id) => repos.themes.duplicate(parse(idArg, id)))
  handle('themes:reset', (id) => repos.themes.reset(parse(idArg, id)))
  handle('themes:delete', (id) => repos.themes.delete(parse(idArg, id)))
  handle('themes:export', async (id, e) => {
    const theme = repos.themes.get(parse(idArg, id))
    if (!theme) throw new Error('Theme not found')
    const file = await pickSave(e, `${safeFileName(theme.name)}.${BRAND.fileExtensions.theme}`, BRAND.fileExtensions.theme)
    if (!file) return null
    exportTheme(repos, theme, file)
    return file
  })
  handle('themes:import', async (list, e) => {
    const files = list ? validPaths(list) : await pickFiles(e, 'theme')
    const res: ImportResult = { imported: 0, skipped: 0, errors: [], ids: [] }
    for (const f of files) {
      try {
        res.ids.push(importThemeFile(repos, f).id)
        res.imported++
      } catch (err) {
        res.errors.push(`${basename(f)}: ${(err as Error).message}`)
      }
    }
    return res
  })

  // ------------------------------------------------------------- songs
  handle('songs:list', (q) =>
    repos.songs.list(
      parse(z.object({ search: z.string().max(200).optional(), category: z.string().max(100).optional(), limit: z.number().int().min(1).max(5000).optional() }), q ?? {})
    )
  )
  handle('songs:get', (id) => repos.songs.get(parse(idArg, id)))
  handle('songs:save', (input) => repos.songs.save(parse(SongInputSchema, input, 'song')))
  handle('songs:duplicate', (id) => repos.songs.duplicate(parse(idArg, id)))
  handle('songs:delete', (id) => repos.songs.delete(parse(idArg, id)))
  handle('songs:categories', () => repos.songs.categories())
  handle('songs:usage', (id) => {
    const rows = repos.db
      .prepare(`SELECT DISTINCT s.id AS serviceId, s.name AS serviceName, s.date FROM service_items i
                JOIN services s ON s.id = i.service_id WHERE i.type = 'song' AND i.ref_id = ? ORDER BY s.date DESC LIMIT 50`)
      .all(parse(idArg, id))
    return rows as { serviceId: string; serviceName: string; date: string }[]
  })
  handle('songs:import', async (list, e) => {
    const files = list ? validPaths(list) : await pickFiles(e, 'song')
    const res: ImportResult = { imported: 0, skipped: 0, errors: [], ids: [] }
    for (const f of files) {
      try {
        for (const input of parseSongFile(f)) {
          res.ids.push(repos.songs.save(parse(SongInputSchema, input, 'song')).id)
          res.imported++
        }
      } catch (err) {
        res.errors.push(`${basename(f)}: ${(err as Error).message}`)
      }
    }
    return res
  })
  handle('songs:export', async ({ ids, format }, e) => {
    const songs = parse(z.array(idArg).max(20000), ids)
      .map((id) => repos.songs.get(id))
      .filter((s) => !!s)
    if (!songs.length) throw new Error('No songs selected')
    if ((format === 'song' || format === 'txt') && songs.length > 1) {
      const dir = await pickDir(e)
      if (!dir) return null
      writeSongsToDir(songs, dir, format)
      return dir
    }
    const name = songs.length === 1 ? safeFileName(songs[0].title) : 'Songs'
    const file = await pickSave(e, `${name}.${format}`, format)
    if (!file) return null
    const content =
      format === 'csv' ? songsToCsv(songs) : format === 'txt' ? songToText(songs[0]) : songFileContent(songs)
    writeFileSync(file, content, 'utf8')
    return file
  })

  // ------------------------------------------------------------- services
  handle('services:list', () => repos.services.list())
  handle('services:get', (id) => repos.services.get(parse(idArg, id)))
  handle('services:create', (input) => repos.services.create(parse(ServiceInputSchema, input, 'service')))
  handle('services:update', ({ id, patch }) =>
    repos.services.update(parse(idArg, id), parse(ServiceInputSchema.partial(), patch, 'service'))
  )
  handle('services:delete', (id) => repos.services.delete(parse(idArg, id)))
  handle('services:duplicate', (a) =>
    repos.services.duplicate(
      parse(idArg, a.id),
      a.name ? parse(z.string().max(300), a.name) : undefined,
      a.date ? parse(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), a.date) : undefined
    )
  )
  handle('services:opened', (id) => repos.services.markOpened(parse(idArg, id)))
  handle('services:export', async ({ id, includeMedia }, e) => {
    const svc = repos.services.get(parse(idArg, id))
    if (!svc) throw new Error('Service not found')
    const ext = BRAND.fileExtensions.service
    const file = await pickSave(e, `${safeFileName(`${svc.name} ${svc.date}`)}.${ext}`, ext)
    if (!file) return null
    exportServicePackage(repos, svc.id, file, !!includeMedia)
    return file
  })
  handle('services:import', async (path, e) => {
    const file = path ? validPaths([path])[0] : (await pickFiles(e, 'service', false))[0]
    if (!file) return null
    const svc = importServicePackage(repos, file)
    ctx.broadcast('media:changed', undefined)
    return svc
  })
  handle('services:exportText', async ({ id, format }, e) => {
    const svc = repos.services.get(parse(idArg, id))
    if (!svc) throw new Error('Service not found')
    const fmt = parse(z.enum(['txt', 'csv', 'json']), format)
    const file = await pickSave(e, `${safeFileName(`${svc.name} ${svc.date}`)}.${fmt}`, fmt)
    if (!file) return null
    writeFileSync(file, exportServiceText(repos, svc.id, fmt), 'utf8')
    return file
  })

  // ------------------------------------------------------------- items
  handle('items:add', ({ serviceId, item, position }) =>
    repos.services.addItem(
      parse(idArg, serviceId),
      parse(ItemInputSchema, item, 'service item'),
      position === undefined ? undefined : parse(z.number().int().min(0).max(100000), position)
    )
  )
  handle('items:update', ({ id, patch }) =>
    repos.services.updateItem(parse(idArg, id), parse(ItemInputSchema.partial(), patch, 'service item'))
  )
  handle('items:delete', (id) => repos.services.deleteItem(parse(idArg, id)))
  handle('items:duplicate', (id) => repos.services.duplicateItem(parse(idArg, id)))
  handle('items:reorder', ({ serviceId, ids }) =>
    repos.services.reorder(parse(idArg, serviceId), parse(z.array(idArg).max(5000), ids))
  )

  // ------------------------------------------------------------- media
  handle('media:list', (q) =>
    repos.media.list(
      parse(
        z.object({
          type: z.enum(['image', 'video', 'audio']).optional(),
          search: z.string().max(200).optional(),
          favorites: z.boolean().optional(),
          folder: z.string().max(200).optional()
        }),
        q ?? {}
      )
    )
  )
  handle('media:get', (id) => repos.media.get(parse(idArg, id)))
  handle('media:getMany', (ids) =>
    parse(z.array(idArg).max(5000), ids)
      .map((id) => repos.media.get(id))
      .filter((m) => !!m)
  )
  handle('media:import', async ({ paths: list, folder }, e) => {
    const files = list ? validPaths(list) : await pickFiles(e, 'media')
    const res = await importMedia(repos, files, folder ? parse(z.string().max(200), folder) : '')
    if (res.imported) ctx.broadcast('media:changed', undefined)
    return res
  })
  handle('media:update', ({ id, patch }) => {
    const p = parse(z.object({ name: z.string().max(300).optional(), tags: z.array(z.string().max(60)).max(50).optional(), folder: z.string().max(200).optional() }), patch)
    const m = repos.media.update(parse(idArg, id), p)
    ctx.broadcast('media:changed', undefined)
    return m
  })
  handle('media:setMeta', (a) => {
    const p = parse(z.object({ id: idArg, width: z.number().nullable().optional(), height: z.number().nullable().optional(), duration: z.number().nullable().optional() }), a)
    repos.media.update(p.id, { width: p.width, height: p.height, duration: p.duration })
  })
  handle('media:delete', (id) => {
    const mid = parse(idArg, id)
    repos.media.delete(mid)
    deleteThumbnail(mid)
    ctx.broadcast('media:changed', undefined)
  })
  handle('media:toggleFavorite', (id) => repos.favorites.toggle('media', parse(idArg, id)))
  handle('media:checkMissing', () => {
    const r = checkMissing(repos)
    ctx.broadcast('media:changed', undefined)
    return r
  })
  handle('media:relink', async ({ id, path }, e) => {
    const m = repos.media.get(parse(idArg, id))
    if (!m) throw new Error('Media not found')
    const file = path ? validPaths([path])[0] : (await pickFiles(e, m.type, false))[0]
    if (!file) return null
    if (repos.media.getByPath(file) && repos.media.getByPath(file)!.id !== m.id) throw new Error('That file is already in the library')
    const updated = repos.media.update(m.id, { path: file, missing: false, size: statSync(file).size })
    await makeThumbnail(repos, updated)
    ctx.broadcast('media:changed', undefined)
    return repos.media.get(m.id)
  })
  handle('media:folders', () => repos.media.folders())
  handle('web:saveMedia', async (a) => {
    const p = parse(z.object({ url: z.string().max(8000), kind: z.enum(['image', 'video', 'audio']), name: z.string().max(200).optional() }), a)
    const m = await saveWebMedia(repos, p.url, p.kind, p.name)
    ctx.broadcast('media:changed', undefined)
    return m
  })
  handle('web:saveCapture', async (a) => {
    const p = parse(z.object({ dataUrl: z.string().max(40_000_000), title: z.string().max(300) }), a)
    const m = await saveWebCapture(repos, p.dataUrl, p.title)
    ctx.broadcast('media:changed', undefined)
    return m
  })
  handle('media:saveThumbnail', (a) => {
    const p = parse(z.object({ id: idArg, dataUrl: z.string().max(5_000_000).startsWith('data:image/jpeg;base64,') }), a)
    if (!repos.media.get(p.id)) throw new Error('Media not found')
    saveThumbnailData(repos, p.id, Buffer.from(p.dataUrl.slice('data:image/jpeg;base64,'.length), 'base64'))
  })

  // ------------------------------------------------------------- bible
  const refSchema = z.object({
    translationId: idArg,
    book: z.number().int().min(1).max(66),
    chapter: z.number().int().min(1).max(200),
    verseStart: z.number().int().min(1).max(200),
    verseEnd: z.number().int().min(1).max(200)
  })
  handle('bible:translations', () => repos.bible.translations())
  handle('bible:structure', (id) => repos.bible.structure(parse(idArg, id)))
  handle('bible:chapter', (a) => {
    const p = parse(refSchema.pick({ translationId: true, book: true, chapter: true }), a)
    return repos.bible.chapter(p.translationId, p.book, p.chapter)
  })
  handle('bible:passage', (ref) => repos.bible.passage(parse(refSchema, ref)))
  handle('bible:search', (a) => {
    const p = parse(z.object({ query: z.string().max(200), translationId: idArg }), a)
    return repos.bible.search(p.query, p.translationId, 200)
  })
  handle('bible:record', (ref) => repos.bible.recordPassage(parse(refSchema, ref)))
  handle('bible:passages', (a) => repos.bible.passages(a?.limit ?? 30, !!a?.favorites))
  handle('bible:toggleFavorite', (id) => repos.favorites.toggle('passage', parse(idArg, id)))
  handle('bible:import', async (list, e) => {
    const files = list ? validPaths(list) : await pickFiles(e, 'bible', true)
    const res: BibleImportResult = { imported: [], errors: [], warnings: [] }
    for (const f of files) {
      const name = basename(f)
      try {
        const { bible, entry } = readBibleFileDetailed(f)
        res.imported.push(repos.bible.importTranslation(bible))
        if (entry && (entry.status === 'copyrighted' || entry.status === 'unverified')) {
          res.warnings.push(`${entry.name} (${entry.abbreviation}) is ${entry.status === 'copyrighted' ? 'copyrighted' : 'of unverified copyright'} — only project it if your church has the publisher's permission.`)
        }
      } catch (err) {
        res.errors.push(`${name}: ${(err as Error).message}`)
      }
    }
    return res
  })
  handle('bible:library', () => listBibleLibrary(repos))
  handle('bible:installLibrary', (abbr) => installLibraryBible(repos, parse(z.string().min(1).max(12), abbr)))
  handle('bible:usage', (id) => repos.bible.usage(parse(idArg, id)))
  handle('bible:deleteTranslation', (id) => {
    const tid = parse(idArg, id)
    const remaining = repos.bible.translations().filter((t) => t.id !== tid)
    if (!remaining.length) throw new Error('Keep at least one Bible version — install another one before removing this.')
    repos.bible.deleteTranslation(tid)
    // Never leave the default pointing at a removed version
    if (repos.settings.get().bible.defaultTranslationId === tid) {
      repos.settings.save({ bible: { defaultTranslationId: (remaining.find((t) => t.abbreviation === 'KJV') ?? remaining[0]).id } })
    }
  })
  handle('bible:schedule', () => repos.bible.schedule())
  handle('bible:scheduleAdd', (a) => {
    const p = parse(z.object({ ref: refSchema, versesPerSlide: z.number().int().min(0).max(20) }), a)
    if (p.ref.verseEnd < p.ref.verseStart) throw new Error('Invalid verse range')
    return repos.bible.addToSchedule(p.ref, p.versesPerSlide)
  })
  handle('bible:scheduleRemove', (id) => repos.bible.removeFromSchedule(parse(idArg, id)))
  handle('bible:scheduleReorder', (ids) => repos.bible.reorderSchedule(parse(z.array(idArg).max(1000), ids)))
  handle('bible:scheduleClear', () => repos.bible.clearSchedule())

  // ------------------------------------------------------------- slide library, drafts
  handle('slides:list', () => repos.slides.list())
  handle('slides:save', (deck) => {
    const d = parse(z.object({ id: idArg.optional(), name: z.string().max(200), slides: z.array(CustomSlideSchema).max(500) }), deck)
    return { id: repos.slides.save(d).id }
  })
  handle('slides:delete', (id) => repos.slides.delete(parse(idArg, id)))
  handle('drafts:save', (d) => {
    const p = parse(z.object({ key: z.string().max(200), label: z.string().max(300), data: z.unknown() }), d)
    repos.drafts.save(p.key, p.label, p.data)
  })
  handle('drafts:get', (key) => repos.drafts.get(parse(z.string().max(200), key)))
  handle('drafts:delete', (key) => repos.drafts.delete(parse(z.string().max(200), key)))

  // ------------------------------------------------------------- backup
  handle('backup:list', () => listBackups())
  handle('backup:create', () => {
    const b = createBackupSync(repos.db, 'manual')
    repos.settings.save({ backup: { lastBackupAt: b.createdAt } })
    pruneBackups(repos.settings.get().backup.keep)
    return b
  })
  handle('backup:restore', (file) => {
    const f = parse(z.string().max(4096), file)
    if (!listBackups().some((b) => b.file === f)) throw new Error('Unknown backup')
    validateBackup(f)
    ctx.restoreDatabase(f)
  })
  handle('backup:restoreFromFile', async (_a, e) => {
    const file = (await pickFiles(e, 'backup', false))[0]
    if (!file) return false
    validateBackup(file)
    ctx.restoreDatabase(file)
    return true
  })
  handle('backup:delete', (file) => {
    const f = parse(z.string().max(4096), file)
    const b = listBackups().find((x) => x.file === f)
    if (!b) throw new Error('Unknown backup')
    unlinkSync(b.file)
  })
  handle('backup:openFolder', () => void shell.openPath(paths.backups()))

  handle('dialog:openFiles', (a, e) => pickFiles(e, parse(z.enum(Object.keys(FILTERS) as [FileFilterKind]), a.kind), a.multiple !== false))

  // ------------------------------------------------------------- displays / output / live
  handle('displays:list', () => listDisplays())
  handle('output:open', ({ displayId }) => {
    const id = displayId === null ? null : parse(z.number().int(), displayId)
    return ctx.output.open(id)
  })
  handle('output:close', () => ctx.output.close())
  handle('output:status', () => ctx.output.status())
  handle('output:identify', () => identifyDisplays())
  handle('live:update', (state) => {
    // Payload is produced by our own operator UI; bound its size defensively.
    if (JSON.stringify(state).length > MAX_LIVE_PAYLOAD) throw new Error('Live payload too large')
    ctx.onLiveUpdate(state as LiveState)
  })
  handle('live:get', () => ctx.output.lastState)
  handle('output:videoStatus', (s) => ctx.sendToOperator('video:status', s))
  handle('output:key', (k) => ctx.sendToOperator('live:remoteKey', k))
  handle('output:ready', () => {
    const s = ctx.output.lastState
    if (s) ctx.output.pushState(s)
  })
}
