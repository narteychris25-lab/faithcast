/**
 * Single source of truth for product naming. To rename the application,
 * change these values plus `name`/`productName` in package.json and
 * `appId`/`productName` in electron-builder.yml.
 */
export const BRAND = {
  name: 'FaithCast',
  /** The logo's two-tone wordmark: first part in ink, second in brand blue. */
  wordmark: ['Faith', 'Cast'],
  tagline: 'Worship presentation for every church',
  /** Must match appId in electron-builder.yml (Windows taskbar grouping uses it). */
  appId: 'com.faithcast.app',
  /** Used for file extensions and URL schemes — lowercase, no spaces. */
  slug: 'faithcast',
  mediaScheme: 'fcmedia',
  /**
   * The app's previous name. Its files, backups and data folder are still read,
   * so a church upgrading from it keeps everything.
   */
  legacy: { name: 'WorshipFlow', slug: 'worshipflow', bibleExtension: 'wfbible' },
  fileExtensions: {
    service: 'churchservice',
    song: 'song',
    theme: 'theme',
    bible: 'fcbible'
  }
} as const
