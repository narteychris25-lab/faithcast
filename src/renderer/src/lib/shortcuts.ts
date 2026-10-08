import type { AppSettings, ShortcutAction } from '@shared/types'

interface KeyLike {
  code: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  meta?: boolean
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
}

/** Canonical combo string, e.g. "Meta+Shift+KeyK", "ArrowRight". */
export function eventCombo(e: KeyLike): string {
  const mods: string[] = []
  if (e.metaKey || e.meta) mods.push('Meta')
  if (e.ctrlKey || e.ctrl) mods.push('Ctrl')
  if (e.altKey || e.alt) mods.push('Alt')
  if (e.shiftKey || e.shift) mods.push('Shift')
  return [...mods, e.code].join('+')
}

export function matchAction(e: KeyLike, shortcuts: AppSettings['shortcuts']): ShortcutAction | null {
  if (['MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'].includes(e.code)) return null
  const combo = eventCombo(e)
  for (const [action, combos] of Object.entries(shortcuts) as [ShortcutAction, string[]][]) {
    if (combos.includes(combo)) return action
  }
  return null
}

const NAMES: Record<string, string> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Return',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Backspace: '⌫',
  Meta: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧'
}

export function comboLabel(combo: string): string {
  return combo
    .split('+')
    .map((p) => NAMES[p] ?? p.replace(/^Key/, '').replace(/^Digit/, ''))
    .join('')
}

/** True when keyboard focus is in a text field, where live shortcuts must not fire. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || el.isContentEditable) return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['checkbox', 'radio', 'range', 'button', 'color'].includes(type)
  }
  return tag === 'SELECT'
}
