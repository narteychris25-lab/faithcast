import type {
  AppSettings,
  BackupInfo,
  BiblePassage,
  BibleReference,
  BibleTranslation,
  BibleVerse,
  BibleLibraryEntry,
  BibleImportResult,
  Church,
  CustomSlide,
  DashboardData,
  DisplayInfo,
  LiveState,
  MediaItem,
  MediaType,
  OutputStatus,
  RecoveryInfo,
  SearchResult,
  Service,
  ServiceItem,
  ServiceItemData,
  ServiceItemType,
  ServiceSummary,
  ServiceWithItems,
  ScheduledPassage,
  Song,
  SongSection,
  SongSummary,
  Theme,
  ThemeSettings,
  Background,
  Transition,
  VideoStatus
} from './types'

export interface SongInput {
  id?: string
  title: string
  author?: string
  copyright?: string
  ccli?: string
  category?: string
  tags?: string[]
  notes?: string
  sections: SongSection[]
  arrangement?: string[]
  themeId?: string | null
}

export interface ServiceInput {
  name: string
  date: string
  time?: string
  notes?: string
  themeId?: string | null
  background?: Background | null
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

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  dataDir: string
  dbPath: string
  electron: string
  chrome: string
  isPackaged: boolean
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  ids: string[]
}

export type FileFilterKind = 'media' | 'image' | 'video' | 'audio' | 'song' | 'service' | 'theme' | 'bible' | 'backup'

/** Request/response map: channel → [argument, result]. */
export interface IpcContract {
  'app:info': [void, AppInfo]
  'app:recovery': [void, RecoveryInfo]
  'app:clearRecovery': [void, void]
  'app:openExternal': [string, void]
  'app:showInFolder': [string, void]
  'app:relaunch': [void, void]
  'app:setUnsaved': [boolean, void]
  'app:loadDemo': [void, { serviceId: string | null }]
  'app:removeDemo': [void, { removed: number }]
  /** Windows: colour and height of the caption-button overlay. */
  'app:titleBar': [{ color: string; symbolColor: string; height: number }, void]
  /** Windows: show the app menu (there is no menu bar) at a point in the window. */
  'app:popupMenu': [{ x: number; y: number }, void]

  'dashboard:get': [void, DashboardData]
  'search:global': [string, SearchResult[]]

  'church:get': [void, Church]
  'church:save': [Partial<Church>, Church]
  'settings:get': [void, AppSettings]
  'settings:save': [unknown, AppSettings]

  'themes:list': [void, Theme[]]
  'themes:create': [{ name: string; settings: ThemeSettings }, Theme]
  'themes:update': [{ id: string; name?: string; settings?: ThemeSettings }, Theme]
  'themes:duplicate': [string, Theme]
  'themes:reset': [string, Theme]
  'themes:delete': [string, void]
  'themes:export': [string, string | null]
  'themes:import': [string[] | null, ImportResult]

  'songs:list': [{ search?: string; category?: string; limit?: number }, SongSummary[]]
  'songs:get': [string, Song | null]
  'songs:save': [SongInput, Song]
  'songs:duplicate': [string, Song]
  'songs:delete': [string, void]
  'songs:categories': [void, string[]]
  'songs:usage': [string, { serviceId: string; serviceName: string; date: string }[]]
  'songs:import': [string[] | null, ImportResult]
  'songs:export': [{ ids: string[]; format: 'song' | 'txt' | 'json' | 'csv' }, string | null]

  'services:list': [void, ServiceSummary[]]
  'services:get': [string, ServiceWithItems | null]
  'services:create': [ServiceInput, ServiceWithItems]
  'services:update': [{ id: string; patch: Partial<ServiceInput> }, Service]
  'services:delete': [string, void]
  'services:duplicate': [{ id: string; name?: string; date?: string }, ServiceWithItems]
  'services:opened': [string, void]
  'services:export': [{ id: string; includeMedia: boolean }, string | null]
  'services:import': [string | null, ServiceWithItems | null]
  'services:exportText': [{ id: string; format: 'txt' | 'csv' | 'json' }, string | null]

  'items:add': [{ serviceId: string; item: ItemInput; position?: number }, ServiceItem]
  'items:update': [{ id: string; patch: Partial<ItemInput> }, ServiceItem]
  'items:delete': [string, void]
  'items:duplicate': [string, ServiceItem]
  'items:reorder': [{ serviceId: string; ids: string[] }, ServiceItem[]]

  'media:list': [{ type?: MediaType; search?: string; favorites?: boolean; folder?: string }, MediaItem[]]
  'media:get': [string, MediaItem | null]
  'media:getMany': [string[], MediaItem[]]
  'media:import': [{ paths: string[] | null; folder?: string }, ImportResult]
  'media:update': [{ id: string; patch: { name?: string; tags?: string[]; folder?: string } }, MediaItem]
  'media:setMeta': [{ id: string; width?: number | null; height?: number | null; duration?: number | null }, void]
  'media:delete': [string, void]
  'media:toggleFavorite': [string, boolean]
  'media:checkMissing': [void, { checked: number; missing: string[] }]
  'media:relink': [{ id: string; path: string | null }, MediaItem | null]
  'media:folders': [void, string[]]
  'media:saveThumbnail': [{ id: string; dataUrl: string }, void]
  'web:saveMedia': [{ url: string; kind: MediaType; name?: string }, MediaItem]
  'web:saveCapture': [{ dataUrl: string; title: string }, MediaItem]

  'bible:translations': [void, BibleTranslation[]]
  'bible:structure': [string, Record<number, number[]>]
  'bible:chapter': [{ translationId: string; book: number; chapter: number }, BibleVerse[]]
  'bible:passage': [BibleReference, BibleVerse[]]
  'bible:search': [{ query: string; translationId: string }, BibleVerse[]]
  'bible:record': [BibleReference, BiblePassage]
  'bible:passages': [{ favorites?: boolean; limit?: number }, BiblePassage[]]
  'bible:toggleFavorite': [string, boolean]
  'bible:import': [string[] | null, BibleImportResult]
  'bible:library': [void, BibleLibraryEntry[]]
  'bible:installLibrary': [string, BibleTranslation]
  'bible:deleteTranslation': [string, void]
  'bible:usage': [string, { serviceItems: number; schedule: number }]
  'bible:schedule': [void, ScheduledPassage[]]
  'bible:scheduleAdd': [{ ref: BibleReference; versesPerSlide: number }, ScheduledPassage]
  'bible:scheduleRemove': [string, void]
  'bible:scheduleReorder': [string[], ScheduledPassage[]]
  'bible:scheduleClear': [void, void]

  'slides:list': [void, { id: string; name: string; slides: CustomSlide[]; updatedAt: string }[]]
  'slides:save': [{ id?: string; name: string; slides: CustomSlide[] }, { id: string }]
  'slides:delete': [string, void]

  'drafts:save': [{ key: string; label: string; data: unknown }, void]
  'drafts:get': [string, unknown]
  'drafts:delete': [string, void]

  'backup:list': [void, BackupInfo[]]
  'backup:create': [void, BackupInfo]
  'backup:restore': [string, void]
  'backup:restoreFromFile': [void, boolean]
  'backup:delete': [string, void]
  'backup:openFolder': [void, void]

  'dialog:openFiles': [{ kind: FileFilterKind; multiple?: boolean }, string[]]

  'displays:list': [void, DisplayInfo[]]
  'output:open': [{ displayId: number | null }, OutputStatus]
  'output:close': [void, OutputStatus]
  'output:status': [void, OutputStatus]
  'output:identify': [void, void]
  'live:update': [LiveState, void]
  'live:get': [void, LiveState | null]

  // Output window → main
  'output:videoStatus': [VideoStatus, void]
  'output:key': [{ code: string; shift: boolean; meta: boolean; alt: boolean; ctrl: boolean }, void]
  'output:ready': [void, void]
}

export type IpcChannel = keyof IpcContract
export type IpcArg<C extends IpcChannel> = IpcContract[C][0]
export type IpcResult<C extends IpcChannel> = IpcContract[C][1]

/** Events pushed from main to renderers. */
export interface IpcEvents {
  'displays:changed': DisplayInfo[]
  'output:status': OutputStatus
  'live:state': LiveState
  'video:status': VideoStatus
  'live:remoteKey': { code: string; shift: boolean; meta: boolean; alt: boolean; ctrl: boolean }
  'media:changed': void
  'app:notice': { level: 'info' | 'warning' | 'error'; message: string }
  'output:identify': { label: string }
  'app:menu': string
}

export type IpcEvent = keyof IpcEvents

const CHANNELS: Record<IpcChannel, true> = {
  'app:info': true,
  'app:recovery': true,
  'app:clearRecovery': true,
  'app:openExternal': true,
  'app:showInFolder': true,
  'app:relaunch': true,
  'app:setUnsaved': true,
  'app:loadDemo': true,
  'app:removeDemo': true,
  'app:titleBar': true,
  'app:popupMenu': true,
  'dashboard:get': true,
  'search:global': true,
  'church:get': true,
  'church:save': true,
  'settings:get': true,
  'settings:save': true,
  'themes:list': true,
  'themes:create': true,
  'themes:update': true,
  'themes:duplicate': true,
  'themes:reset': true,
  'themes:delete': true,
  'themes:export': true,
  'themes:import': true,
  'songs:list': true,
  'songs:get': true,
  'songs:save': true,
  'songs:duplicate': true,
  'songs:delete': true,
  'songs:categories': true,
  'songs:usage': true,
  'songs:import': true,
  'songs:export': true,
  'services:list': true,
  'services:get': true,
  'services:create': true,
  'services:update': true,
  'services:delete': true,
  'services:duplicate': true,
  'services:opened': true,
  'services:export': true,
  'services:import': true,
  'services:exportText': true,
  'items:add': true,
  'items:update': true,
  'items:delete': true,
  'items:duplicate': true,
  'items:reorder': true,
  'media:list': true,
  'media:get': true,
  'media:getMany': true,
  'media:import': true,
  'media:update': true,
  'media:setMeta': true,
  'media:delete': true,
  'media:toggleFavorite': true,
  'media:checkMissing': true,
  'media:relink': true,
  'media:folders': true,
  'media:saveThumbnail': true,
  'web:saveMedia': true,
  'web:saveCapture': true,
  'bible:translations': true,
  'bible:structure': true,
  'bible:chapter': true,
  'bible:passage': true,
  'bible:search': true,
  'bible:record': true,
  'bible:passages': true,
  'bible:toggleFavorite': true,
  'bible:import': true,
  'bible:library': true,
  'bible:installLibrary': true,
  'bible:deleteTranslation': true,
  'bible:usage': true,
  'bible:schedule': true,
  'bible:scheduleAdd': true,
  'bible:scheduleRemove': true,
  'bible:scheduleReorder': true,
  'bible:scheduleClear': true,
  'slides:list': true,
  'slides:save': true,
  'slides:delete': true,
  'drafts:save': true,
  'drafts:get': true,
  'drafts:delete': true,
  'backup:list': true,
  'backup:create': true,
  'backup:restore': true,
  'backup:restoreFromFile': true,
  'backup:delete': true,
  'backup:openFolder': true,
  'dialog:openFiles': true,
  'displays:list': true,
  'output:open': true,
  'output:close': true,
  'output:status': true,
  'output:identify': true,
  'live:update': true,
  'live:get': true,
  'output:videoStatus': true,
  'output:key': true,
  'output:ready': true
}

const EVENTS: Record<IpcEvent, true> = {
  'displays:changed': true,
  'output:status': true,
  'live:state': true,
  'video:status': true,
  'live:remoteKey': true,
  'media:changed': true,
  'app:notice': true,
  'output:identify': true,
  'app:menu': true
}

export const IPC_CHANNELS = Object.keys(CHANNELS) as IpcChannel[]
export const IPC_EVENTS = Object.keys(EVENTS) as IpcEvent[]

/** Shape exposed on window.fc by the preload script. */
export interface FcBridge {
  invoke<C extends IpcChannel>(channel: C, arg: IpcArg<C>): Promise<IpcResult<C>>
  on<E extends IpcEvent>(event: E, cb: (payload: IpcEvents[E]) => void): () => void
  /** Absolute filesystem path of a dropped File (drag-and-drop import). */
  pathForFile(file: File): string
  platform: string
}
