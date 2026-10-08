import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHORTCUTS } from '../../src/shared/defaults'

/** Load the shortcut module as the renderer would on the given OS. */
async function load(platform: 'darwin' | 'win32') {
  vi.resetModules()
  vi.stubGlobal('window', { fc: { platform } })
  return import('../../src/renderer/src/lib/shortcuts')
}

afterEach(() => vi.unstubAllGlobals())

describe('shortcuts on macOS', () => {
  it('uses ⌘ as the primary modifier', async () => {
    const s = await load('darwin')
    expect(s.eventCombo({ code: 'KeyK', metaKey: true })).toBe('Mod+KeyK')
    expect(s.eventCombo({ code: 'KeyK', ctrlKey: true })).toBe('Ctrl+KeyK')
    expect(s.matchAction({ code: 'KeyK', metaKey: true }, DEFAULT_SHORTCUTS)).toBe('search')
    expect(s.matchAction({ code: 'KeyK', ctrlKey: true }, DEFAULT_SHORTCUTS)).toBeNull()
    expect(s.comboLabel('Mod+Shift+KeyZ')).toBe('⌘⇧Z')
    expect(s.comboLabel('Alt+Digit1')).toBe('⌥1')
  })

  it('still matches bindings saved as Meta+ before Mod existed', async () => {
    const s = await load('darwin')
    const old = { ...DEFAULT_SHORTCUTS, search: ['Meta+KeyF'] }
    expect(s.matchAction({ code: 'KeyF', metaKey: true }, old)).toBe('search')
    expect(s.comboLabel('Meta+KeyF')).toBe('⌘F')
  })
})

describe('shortcuts on Windows', () => {
  it('uses Ctrl as the primary modifier', async () => {
    const s = await load('win32')
    expect(s.eventCombo({ code: 'KeyK', ctrlKey: true })).toBe('Mod+KeyK')
    expect(s.eventCombo({ code: 'KeyK', metaKey: true })).toBe('Win+KeyK')
    expect(s.matchAction({ code: 'KeyK', ctrlKey: true }, DEFAULT_SHORTCUTS)).toBe('search')
    expect(s.matchAction({ code: 'KeyK', metaKey: true }, DEFAULT_SHORTCUTS)).toBeNull()
    // Keys forwarded from the output window use the short field names
    expect(s.matchAction({ code: 'KeyF', ctrl: true }, DEFAULT_SHORTCUTS)).toBe('search')
  })

  it('labels keys the Windows way', async () => {
    const s = await load('win32')
    expect(s.comboLabel('Mod+Shift+KeyZ')).toBe('Ctrl+Shift+Z')
    expect(s.comboLabel('Alt+ArrowUp')).toBe('Alt+↑')
    expect(s.comboLabel('Enter')).toBe('Enter')
    expect(s.comboLabel('Meta+KeyK')).toBe('Ctrl+K') // binding made on a Mac, restored from a backup
  })
})
