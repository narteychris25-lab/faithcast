import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { Theme, ThemeSettings } from '@shared/types'
import { DEFAULT_THEME_SETTINGS, deepMerge } from '@shared/defaults'
import type { Repos } from '../db/repos'
import { paths } from '../paths'
import { parse, ThemeSettingsSchema, z } from '../validation'

/**
 * .theme file format (JSON):
 * { "format": "worshipflow-theme", "version": 1, "name": "...", "settings": ThemeSettings,
 *   "backgroundImage"?: { "name": "bg.jpg", "data": "<base64>" } }
 * Image backgrounds are embedded so themes are portable between computers.
 */
const THEME_FORMAT = 'worshipflow-theme'
const MAX_FILE = 40 * 1024 * 1024
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i

const ThemeFile = z.object({
  format: z.literal(THEME_FORMAT),
  version: z.literal(1),
  name: z.string().min(1).max(200),
  settings: z.unknown(),
  backgroundImage: z.object({ name: z.string().max(200), data: z.string() }).optional()
})

export function exportTheme(repos: Repos, theme: Theme, file: string): void {
  const out: z.infer<typeof ThemeFile> = { format: THEME_FORMAT, version: 1, name: theme.name, settings: theme.settings }
  const bg = theme.settings.background
  if (bg.kind === 'image' && bg.mediaId) {
    const media = repos.media.get(bg.mediaId)
    if (media && !media.missing && IMAGE_EXT.test(media.path) && statSync(media.path).size < 25 * 1024 * 1024) {
      out.backgroundImage = { name: `${media.name}${extname(media.path)}`, data: readFileSync(media.path).toString('base64') }
    }
  }
  writeFileSync(file, JSON.stringify(out, null, 2), 'utf8')
}

export function importThemeFile(repos: Repos, file: string): Theme {
  if (statSync(file).size > MAX_FILE) throw new Error('Theme file is too large')
  const data = parse(ThemeFile, JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')), 'theme file')
  // Fill fields added in newer versions, then validate strictly.
  const settings = parse(ThemeSettingsSchema, deepMerge(DEFAULT_THEME_SETTINGS, data.settings), 'theme settings') as ThemeSettings
  if (data.backgroundImage && IMAGE_EXT.test(data.backgroundImage.name)) {
    const safe = data.backgroundImage.name.replace(/[^\w.-]/g, '_')
    const target = join(paths.library(), `${Date.now()}-${safe}`)
    writeFileSync(target, Buffer.from(data.backgroundImage.data, 'base64'))
    const media = repos.media.insert({ name: safe.replace(/\.\w+$/, ''), type: 'image', path: target, size: statSync(target).size, folder: 'Themes' })
    settings.background.mediaId = media.id
  } else if (settings.background.mediaId && !repos.media.get(settings.background.mediaId)) {
    settings.background.mediaId = null
    if (settings.background.kind === 'image' || settings.background.kind === 'video') settings.background.kind = 'color'
  }
  // Clear references to media that do not exist on this machine
  return repos.themes.create(data.name, settings)
}
