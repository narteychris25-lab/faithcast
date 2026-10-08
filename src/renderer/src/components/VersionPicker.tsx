import { useEffect, useRef, useState } from 'react'
import type { BibleTranslation } from '@shared/types'
import { cx } from '@/lib/format'
import { comboLabel } from '@/lib/shortcuts'

/** Remembered Bible-page version (per computer); cleared when a new default is chosen in Settings → Bibles. */
export const VERSION_PREF = 'fc.bible.version'

/**
 * One-click Bible version buttons (KJV · NKJV · ESV…) instead of a dropdown.
 * One row that scrolls sideways (trackpad swipe or mouse wheel, no visible
 * scrollbar); the edges fade when there are more versions that way.
 * With `shortcuts`, the first nine also answer to ⌥1–⌥9 (the caller handles the keys).
 */
export function VersionPicker({
  translations,
  value,
  onChange,
  shortcuts = false
}: {
  translations: BibleTranslation[]
  value: string
  onChange: (id: string) => void
  shortcuts?: boolean
}) {
  const row = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })
  const measure = () => {
    const el = row.current
    if (el) setMore({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }

  useEffect(() => {
    const el = row.current
    if (!el) return
    // A plain mouse wheel scrolls vertically; turn it into sideways scrolling here
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [])

  // Keep the selected version in view (e.g. after ⌥7)
  useEffect(() => {
    const el = row.current
    const b = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !b) return measure()
    const pad = 24
    if (b.offsetLeft < el.scrollLeft + pad) el.scrollTo({ left: b.offsetLeft - pad, behavior: 'smooth' })
    else if (b.offsetLeft + b.offsetWidth > el.scrollLeft + el.clientWidth - pad)
      el.scrollTo({ left: b.offsetLeft + b.offsetWidth - el.clientWidth + pad, behavior: 'smooth' })
    measure()
  }, [value, translations.length])

  const fade = `linear-gradient(to right, ${more.left ? 'transparent, #000 24px' : '#000, #000'}, ${more.right ? '#000 calc(100% - 24px), transparent' : '#000, #000'})`
  return (
    <div
      ref={row}
      role="radiogroup"
      aria-label="Translation"
      onScroll={measure}
      className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
    >
      {translations.map((t, i) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${t.abbreviation} — ${t.name}`}
            data-tip={`${t.name}${shortcuts && i < 9 ? ` · ${comboLabel(`Alt+Digit${i + 1}`)}` : ''}`}
            onClick={() => onChange(t.id)}
            className={cx(
              'h-7 min-w-11 shrink-0 rounded-md border px-2 text-[12px] font-semibold tracking-wide transition-colors',
              on ? 'border-accent bg-accent text-white' : 'border-line bg-panel-2 text-muted hover:border-line-strong hover:text-fg'
            )}
          >
            {t.abbreviation}
          </button>
        )
      })}
    </div>
  )
}

/** ⌥1–⌥9 → index 0–8 (by physical key, so it works whatever ⌥-digit types). */
export function versionShortcutIndex(e: KeyboardEvent): number | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null
  const m = /^Digit([1-9])$/.exec(e.code)
  return m ? Number(m[1]) - 1 : null
}
