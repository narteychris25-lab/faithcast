/**
 * Single source of truth for product naming. To rename the application,
 * change these values plus `name`/`productName` in package.json and
 * `appId`/`productName` in electron-builder.yml.
 */
export const BRAND = {
  name: 'WorshipFlow',
  /** Used for file extensions and URL schemes — lowercase, no spaces. */
  slug: 'worshipflow',
  mediaScheme: 'wfmedia',
  fileExtensions: {
    service: 'churchservice',
    song: 'song',
    theme: 'theme',
    bible: 'wfbible'
  }
} as const
