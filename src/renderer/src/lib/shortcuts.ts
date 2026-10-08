import type { AppSettings, ShortcutAction } from '@shared/types'
import { IS_MAC } from './platform'

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

/**
 * Canonical combo string, e.g. "Mod+Shift+KeyK", "ArrowRight". "Mod" is the
 * platform's primary modifier (⌘ on macOS, Ctrl on Windows), so bindings
 * carry over between the two; "Ctrl" (macOS) and "Win" (Windows) are the other key.
 */
export function eventCombo(e: KeyLike): string {
  const meta = e.metaKey || e.meta
  const ctrl = e.ctrlKey || e.ctrl
  const mods: string[] = []
  if (IS_MAC ? meta : ctrl) mods.push('Mod')
  if (IS_MAC && ctrl) mods.push('Ctrl')
  if (!IS_MAC && meta) mods.push('Win')
  if (e.altKey || e.alt) mods.push('Alt')
  if (e.shiftKey || e.shift) mods.push('Shift')
  return [...mods, e.code].join('+')
}

/** Bindings saved before "Mod" existed used "Meta" (⌘). */
const normalize = (combo: string) => combo.replace(/(^|\+)Meta(?=\+)/, '$1Mod')

export function matchAction(e: KeyLike, shortcuts: AppSettings['shortcuts']): ShortcutAction | null {
  if (['MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'].includes(e.code)) return null
  const combo = eventCombo(e)
  for (const [action, combos] of Object.entries(shortcuts) as [ShortcutAction, string[]][]) {
    if (combos.some((c) => normalize(c) === combo)) return action
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
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Period: '.',
  Comma: ',',
  Slash: '/',
  ...(IS_MAC
    ? { Enter: 'Return', Backspace: '⌫', Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' }
    : { Enter: 'Enter', Backspace: 'Backspace', Delete: 'Del', Mod: 'Ctrl', Win: 'Win', Alt: 'Alt', Shift: 'Shift' })
}

/** Display form: "⇧⌘K" on macOS, "Ctrl+Shift+K" on Windows. */
export function comboLabel(combo: string): string {
  return normalize(combo)
    .split('+')
    .map((p) => NAMES[p] ?? p.replace(/^Key/, '').replace(/^Digit/, ''))
    .join(IS_MAC ? '' : '+')
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
