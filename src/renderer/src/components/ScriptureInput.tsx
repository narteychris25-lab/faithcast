import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { BIBLE_BOOKS, completionStart, findBook, matchBooks, bookName, type BibleBookInfo } from '@shared/bible-books'
import { cx } from '@/lib/format'

/**
 * EasyWorship-style scripture entry: [Book] [Chapter] : [Verse]
 *
 * Book: typing letters completes the best matching book inline ("jo" →
 * "Jo|shua", rest selected) with a list of other matches. Space, Tab, → or a
 * number accept it and jump to Chapter. ↑/↓ choose another book, Backspace
 * removes the suggestion, Esc closes the list.
 * Chapter: numbers; ":" or Space jump to Verse. Verse: "16" or "16-18".
 * Return in any box opens the passage. Backspace in an empty box goes back.
 *
 * The component's value is the combined reference string ("John 3:16-18"),
 * so callers parse it with parseReference as before.
 */
interface Props {
  value: string
  onChange: (value: string) => void
  /** Return pressed: open / add the reference. */
  onSubmit?: (value: string) => void
  /** Book numbers present in the current translation; others are not suggested. */
  available?: Set<number>
  /** Chapter/verse counts per book: limits suggestions and powers the hint line. */
  structure?: Record<number, number[]>
  placeholder?: string
  autoFocus?: boolean
  label?: string
  className?: string
  /** Focus left the whole scripture box (not just moved between its fields). */
  onBlur?: () => void
}

const compact = (s: string) => s.toLowerCase().replace(/[\s.]/g, '')
const isFullBookName = (s: string) => BIBLE_BOOKS.some((b) => compact(b.name) === compact(s))

/** "1 John 3:16-18" → { book: "1 John", chapter: "3", verse: "16-18" } */
function split(value: string): { book: string; chapter: string; verse: string } {
  const m = /^\s*((?:[1-3]\s*)?[^\d:]*?)\s*(\d+)?\s*(?::\s*([\d\s-]*))?\s*$/.exec(value)
  if (!m) return { book: value, chapter: '', verse: '' }
  return { book: m[1].trim(), chapter: m[2] ?? '', verse: (m[3] ?? '').replace(/\s/g, '') }
}

function compose(book: string, chapter: string, verse: string): string {
  const b = book.trim()
  if (!b) return ''
  if (!chapter) return isFullBookName(b) ? `${b} ` : b
  return `${b} ${chapter}${verse ? `:${verse}` : ''}`
}

export function ScriptureInput({ value, onChange, onSubmit, available, structure, placeholder = 'Book', autoFocus, label = 'Scripture reference', className, onBlur }: Props) {
  const bookRef = useRef<HTMLInputElement>(null)
  const chapterRef = useRef<HTMLInputElement>(null)
  const verseRef = useRef<HTMLInputElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const initial = split(value)
  const [bookText, setBookText] = useState(initial.book)
  const [chapter, setChapter] = useState(initial.chapter)
  const [verse, setVerse] = useState(initial.verse)
  const [suppressed, setSuppressed] = useState(false)
  const [active, setActive] = useState(0)
  const [bookFocused, setBookFocused] = useState(false)
  const lastEmitted = useRef(value)

  // Follow external changes (e.g. cleared after adding, or a different item selected).
  useEffect(() => {
    if (value === lastEmitted.current) return
    const p = split(value)
    setBookText(p.book)
    setChapter(p.chapter)
    setVerse(p.verse)
    lastEmitted.current = value
  }, [value])

  function emit(b: string, c: string, v: string) {
    const s = compose(b, c, v)
    lastEmitted.current = s
    onChange(s)
  }

  const matches = useMemo(
    () => (suppressed || !bookFocused ? [] : matchBooks(bookText, available).slice(0, 8)),
    [bookText, available, suppressed, bookFocused]
  )
  const current: BibleBookInfo | undefined = matches[Math.min(active, matches.length - 1)]
  const start = current ? completionStart(bookText, current.name) : -1
  const display = current && start >= 0 ? current.name : bookText

  // Keep an inline completion selected so the next letter replaces it.
  useLayoutEffect(() => {
    const el = bookRef.current
    if (el && document.activeElement === el && current && start >= 0) el.setSelectionRange(start, current.name.length)
  }, [display, start, current])

  /** Move focus synchronously so the very next keystroke lands in the right box. */
  function focusField(el: HTMLInputElement | null) {
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  }

  /** Accept a book and move on to the chapter (optionally starting it with a typed digit). */
  function accept(book: BibleBookInfo, firstDigit = '') {
    const c = firstDigit || chapter
    setBookText(book.name)
    setChapter(c)
    setActive(0)
    setSuppressed(false)
    emit(book.name, c, verse)
    focusField(chapterRef.current)
  }

  const submit = () => onSubmit?.(compose(current && start >= 0 ? current.name : bookText, chapter, verse).trim())

  function onBookKey(e: KeyboardEvent<HTMLInputElement>) {
    if (current) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSuppressed(true)
        return
      }
      // Right after a book number ("1", "2 "), keep typing the name: "1 co" → 1 Corinthians.
      const onlyNumber = /^\s*[1-3]\s*$/.test(bookText)
      if (onlyNumber && (e.key === ' ' || /^[0-9]$/.test(e.key))) {
        if (e.key === ' ') {
          e.preventDefault()
          setBookText(`${bookText.trim()} `)
          emit(`${bookText.trim()} `, chapter, verse)
        }
        return
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        return accept(current, e.key)
      }
      // Return on a fully typed book opens it; on a partial one it accepts the suggestion.
      if (e.key === 'Enter' && compact(bookText) === compact(current.name)) {
        e.preventDefault()
        return submit()
      }
      if (e.key === ' ' || e.key === 'Tab' || e.key === 'Enter' || e.key === ':' || (e.key === 'ArrowRight' && start >= 0)) {
        e.preventDefault()
        return accept(current)
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === ' ' && bookText.trim() && findBook(bookText)) {
      // Book already complete (e.g. after Esc): Space moves on to the chapter.
      e.preventDefault()
      focusField(chapterRef.current)
    }
  }

  function onChapterKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === ':' || e.key === '.' || e.key === ' ') {
      e.preventDefault()
      focusField(verseRef.current)
    } else if (e.key === 'Backspace' && !chapter) {
      e.preventDefault()
      focusField(bookRef.current)
    }
  }

  function onVerseKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Backspace' && !verse) {
      e.preventDefault()
      focusField(chapterRef.current)
    }
  }

  // Hint: "John · 21 chapters" or "John 3 · 36 verses"
  const hint = useMemo(() => {
    if (!structure || current || !bookText.trim()) return ''
    const book = findBook(bookText)
    if (!book || !structure[book]) return ''
    const chapters = structure[book]
    if (!chapter) return `${bookName(book)} · ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`
    const verses = chapters[Number(chapter) - 1]
    return verses ? `${bookName(book)} ${chapter} · ${verses} verses` : `${bookName(book)} has only ${chapters.length} chapters`
  }, [bookText, chapter, structure, current])

  const field = 'h-8 rounded-md border border-line bg-panel-2 text-[13px] text-fg placeholder:text-dim focus:border-accent focus:outline-none'

  return (
    <div
      ref={groupRef}
      className={cx('relative', bookFocused && matches.length > 0 && 'z-40', className)}
      onBlur={(e) => {
        if (!groupRef.current?.contains(e.relatedTarget as Node)) onBlur?.()
      }}
    >
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <BookOpen size={14} className="pointer-events-none absolute top-2 left-2.5 text-dim" />
          <input
            ref={bookRef}
            value={display}
            autoFocus={autoFocus}
            aria-label={label}
            aria-autocomplete="both"
            aria-expanded={bookFocused && matches.length > 0}
            role="combobox"
            spellCheck={false}
            autoComplete="off"
            placeholder={placeholder}
            onFocus={() => setBookFocused(true)}
            onBlur={() => setBookFocused(false)}
            onKeyDown={onBookKey}
            onChange={(e) => {
              const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith('delete')
              setSuppressed(!!deleting)
              setActive(0)
              const text = e.target.value
              // A whole reference typed or pasted into the book box: spread it across the fields.
              const p = split(text)
              const book = p.chapter ? findBook(p.book) : null
              if (book) {
                const name = bookName(book)
                setBookText(name)
                setChapter(p.chapter)
                setVerse(p.verse)
                emit(name, p.chapter, p.verse)
                focusField(text.includes(':') ? verseRef.current : chapterRef.current)
                return
              }
              setBookText(text)
              if (!text.trim()) {
                setChapter('')
                setVerse('')
                emit('', '', '')
              } else emit(text, chapter, verse)
            }}
            className={cx(field, 'w-full pr-2 pl-8')}
          />
        </div>
        <input
          ref={chapterRef}
          value={chapter}
          inputMode="numeric"
          aria-label="Chapter"
          placeholder="Ch"
          autoComplete="off"
          onKeyDown={onChapterKey}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, '').slice(0, 3)
            setChapter(c)
            emit(bookText, c, verse)
          }}
          className={cx(field, 'w-12 px-1.5 text-center tabular-nums')}
        />
        <span className="text-dim">:</span>
        <input
          ref={verseRef}
          value={verse}
          inputMode="numeric"
          aria-label="Verse"
          placeholder="Verse"
          autoComplete="off"
          onKeyDown={onVerseKey}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d-]/g, '').replace(/-{2,}/g, '-').slice(0, 7)
            setVerse(v)
            emit(bookText, chapter, v)
          }}
          className={cx(field, 'w-16 px-1.5 text-center tabular-nums')}
        />
      </div>
      {bookFocused && matches.length > 0 && (
        <ul role="listbox" className="absolute top-9 right-0 left-0 z-40 overflow-hidden rounded-md border border-line-strong bg-panel py-1 shadow-2xl">
          {matches.map((b, i) => (
            <li
              key={b.number}
              role="option"
              aria-selected={b === current}
              onMouseDown={(e) => {
                e.preventDefault()
                accept(b)
              }}
              onMouseEnter={() => setActive(i)}
              className={cx('flex cursor-pointer items-center gap-2 px-2.5 py-1 text-[13px]', b === current ? 'bg-accent text-white' : 'hover:bg-panel-3')}
            >
              <span className="flex-1">{b.name}</span>
              <span className={cx('text-[11px]', b === current ? 'text-white/70' : 'text-dim')}>
                {structure?.[b.number] ? `${structure[b.number].length} ch` : b.testament}
              </span>
            </li>
          ))}
          <li className="border-t border-line px-2.5 pt-1 text-[10px] text-dim">Space or a number to accept · ↑↓ choose · Esc dismiss</li>
        </ul>
      )}
      {hint && <div className="mt-1 text-[11px] text-dim">{hint}</div>}
    </div>
  )
}
