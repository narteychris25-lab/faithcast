import type { MediaType } from '@shared/types'

/** Extensions accepted for import, grouped by media type. */
export const MEDIA_EXTENSIONS: Record<MediaType, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif', 'tif', 'tiff'],
  video: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv', 'avi', 'wmv', 'mpg', 'mpeg', '3gp'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aif', 'aiff', 'weba']
}

/** Images Chromium cannot draw directly; converted to JPEG at import via macOS ImageIO (not available on Windows). */
export const CONVERT_IMAGE_EXTENSIONS = ['heic', 'heif', 'tif', 'tiff']

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  weba: 'audio/webm'
}

export function mimeFor(ext: string): string {
  return MIME[ext.replace(/^\./, '').toLowerCase()] ?? 'application/octet-stream'
}

export function mediaTypeFor(ext: string): MediaType | null {
  const e = ext.replace(/^\./, '').toLowerCase()
  for (const [type, exts] of Object.entries(MEDIA_EXTENSIONS) as [MediaType, string[]][]) {
    if (exts.includes(e)) return type
  }
  return null
}
