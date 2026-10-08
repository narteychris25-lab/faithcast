/**
 * Platform differences the operator UI needs: the primary shortcut modifier
 * (⌘ on macOS, Ctrl on Windows) and the names of OS features in help text.
 */
const platform = typeof window !== 'undefined' && window.fc ? window.fc.platform : 'darwin'

export const IS_MAC = platform === 'darwin'
export const IS_WINDOWS = platform === 'win32'

/** True when the platform's primary shortcut modifier is held (⌘ on macOS, Ctrl elsewhere). */
export function isMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey
}

export const OS = {
  name: IS_MAC ? 'macOS' : IS_WINDOWS ? 'Windows' : 'Linux',
  /** "this Mac" / "this PC" */
  computer: IS_MAC ? 'Mac' : 'PC',
  fileManager: IS_MAC ? 'Finder' : IS_WINDOWS ? 'File Explorer' : 'the file manager',
  showInFolder: IS_MAC ? 'Show in Finder' : IS_WINDOWS ? 'Show in File Explorer' : 'Show in Folder'
}
