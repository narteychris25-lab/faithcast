import {
  BookOpen,
  Film,
  Globe,
  HandCoins,
  Hand,
  Heading,
  Image as ImageIcon,
  Megaphone,
  MessageSquareText,
  Music,
  Music2,
  Presentation,
  Shapes,
  type LucideIcon
} from 'lucide-react'
import type { ItemInput } from '@shared/ipc'
import type { ServiceItem, ServiceItemType } from '@shared/types'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { formatReference } from '@shared/bible-books'

export const ITEM_META: Record<ServiceItemType, { label: string; icon: LucideIcon; color: string }> = {
  song: { label: 'Song', icon: Music, color: 'text-sky-400' },
  bible: { label: 'Bible', icon: BookOpen, color: 'text-amber-400' },
  image: { label: 'Image', icon: ImageIcon, color: 'text-emerald-400' },
  video: { label: 'Video', icon: Film, color: 'text-rose-400' },
  audio: { label: 'Audio', icon: Music2, color: 'text-violet-400' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'text-orange-400' },
  custom: { label: 'Custom Slides', icon: Shapes, color: 'text-teal-400' },
  sermon: { label: 'Sermon', icon: MessageSquareText, color: 'text-indigo-300' },
  offering: { label: 'Offering', icon: HandCoins, color: 'text-yellow-300' },
  prayer: { label: 'Prayer', icon: Hand, color: 'text-pink-300' },
  header: { label: 'Section', icon: Heading, color: 'text-muted' },
  web: { label: 'Web', icon: Globe, color: 'text-sky-400' },
  other: { label: 'Other', icon: Presentation, color: 'text-slate-300' }
}

/** Default new item for types that don't need a picker. */
export function blankItem(type: ServiceItemType): ItemInput {
  switch (type) {
    case 'announcement':
      return {
        type,
        title: 'New Announcement',
        data: { announcement: { title: 'Announcement', description: '', date: '', time: '', location: '', imageMediaId: null } }
      }
    case 'custom':
      return {
        type,
        title: 'Custom Slides',
        data: {
          slides: [
            {
              id: crypto.randomUUID(),
              label: 'Slide 1',
              background: null,
              notes: '',
              elements: [{ id: crypto.randomUUID(), kind: 'text', x: 160, y: 390, w: 1600, h: 300, rotation: 0, opacity: 1, text: 'Your text here' }]
            }
          ]
        }
      }
    case 'header':
      return { type, title: 'New Section' }
    case 'sermon':
      return { type, title: 'Sermon', data: { body: '' } }
    case 'offering':
      return { type, title: 'Offering', data: { body: '' } }
    case 'prayer':
      return { type, title: 'Prayer', data: { body: '' } }
    default:
      return { type, title: ITEM_META[type].label, data: { body: '' } }
  }
}

export function mediaItemInput(m: { id: string; name: string; type: 'image' | 'video' | 'audio' }): ItemInput {
  return {
    type: m.type,
    title: m.name,
    data: {
      mediaId: m.id,
      media: { ...DEFAULT_MEDIA_SETTINGS, fit: m.type === 'image' ? 'cover' : 'contain', loop: m.type === 'audio' ? false : false }
    }
  }
}

export function itemSubtitle(item: ServiceItem, extra: { author?: string; translation?: string; media?: string; slideCount?: number }): string {
  switch (item.type) {
    case 'song':
      return extra.author ?? ''
    case 'bible': {
      const b = item.data.bible
      return b ? `${formatReference(b.book, b.chapter, b.verseStart, b.verseEnd)}${extra.translation ? ` · ${extra.translation}` : ''}` : ''
    }
    case 'image':
    case 'video':
    case 'audio':
      return extra.media ?? ''
    case 'announcement': {
      const a = item.data.announcement
      return a ? [a.date, a.time, a.location].filter(Boolean).join(' · ') : ''
    }
    case 'custom':
      return `${item.data.slides?.length ?? 0} slide${item.data.slides?.length === 1 ? '' : 's'}`
    case 'header':
      return ''
    case 'web':
      try {
        return item.data.web ? new URL(item.data.web.url).hostname.replace(/^www\./, '') : ''
      } catch {
        return ''
      }
    default:
      return (item.data.body ?? '').split('\n')[0] ?? ''
  }
}

export const DRAG_MIME = 'application/x-faithcast-item'
