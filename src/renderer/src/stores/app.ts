import { create } from 'zustand'
import type { AppSettings, BibleTranslation, Church, DisplayInfo, OutputStatus, Theme } from '@shared/types'
import { DEFAULT_CHURCH, DEFAULT_SETTINGS } from '@shared/defaults'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/overlays'

export type View = 'dashboard' | 'planner' | 'live' | 'songs' | 'bible' | 'media' | 'internet' | 'themes' | 'settings' | 'help'

interface AppState {
  ready: boolean
  view: View
  /** View-specific parameter, e.g. the help article or settings tab to open. */
  viewParam: string | null
  currentServiceId: string | null
  settings: AppSettings
  church: Church
  themes: Theme[]
  translations: BibleTranslation[]
  displays: DisplayInfo[]
  output: OutputStatus
  searchOpen: boolean
  quickOpen: boolean

  init: () => Promise<void>
  navigate: (view: View, param?: string | null) => void
  openService: (id: string, view?: View) => void
  saveSettings: (patch: unknown) => Promise<AppSettings>
  saveChurch: (patch: Partial<Church>) => Promise<void>
  reloadThemes: () => Promise<void>
  reloadTranslations: () => Promise<void>
  setDisplays: (d: DisplayInfo[]) => void
  setOutput: (o: OutputStatus) => void
  setSearchOpen: (v: boolean) => void
  setQuickOpen: (v: boolean) => void
}

const CLOSED_OUTPUT: OutputStatus = { open: false, displayId: null, displayLabel: '', fullscreen: false, width: 0, height: 0, previewMode: false }

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  view: 'dashboard',
  viewParam: null,
  currentServiceId: null,
  settings: DEFAULT_SETTINGS,
  church: DEFAULT_CHURCH,
  themes: [],
  translations: [],
  displays: [],
  output: CLOSED_OUTPUT,
  searchOpen: false,
  quickOpen: false,

  async init() {
    const [settings, church, themes, translations, displays, output] = await Promise.all([
      api('settings:get'),
      api('church:get'),
      api('themes:list'),
      api('bible:translations'),
      api('displays:list'),
      api('output:status')
    ])
    let currentServiceId: string | null = null
    try {
      currentServiceId = localStorage.getItem('wf.currentService')
    } catch {
      /* storage unavailable */
    }
    set({ settings, church, themes, translations, displays, output, currentServiceId, ready: true })
  },

  navigate(view, param = null) {
    set({ view, viewParam: param })
  },

  openService(id, view = 'planner') {
    try {
      localStorage.setItem('wf.currentService', id)
    } catch {
      /* ignore */
    }
    void api('services:opened', id).catch(() => undefined)
    set({ currentServiceId: id, view, viewParam: null })
  },

  async saveSettings(patch) {
    try {
      const settings = await api('settings:save', patch)
      set({ settings })
      return settings
    } catch (e) {
      toast.error(e)
      return get().settings
    }
  },

  async saveChurch(patch) {
    try {
      set({ church: await api('church:save', patch) })
    } catch (e) {
      toast.error(e)
    }
  },

  async reloadThemes() {
    set({ themes: await api('themes:list') })
  },
  async reloadTranslations() {
    set({ translations: await api('bible:translations') })
  },
  setDisplays: (displays) => set({ displays }),
  setOutput: (output) => set({ output }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setQuickOpen: (quickOpen) => set({ quickOpen })
}))

export const themeMap = (themes: Theme[]) => new Map(themes.map((t) => [t.id, t]))
