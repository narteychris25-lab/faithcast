'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { BookOpen, CornerDownLeft, Keyboard, Library, MousePointerClick, Search } from 'lucide-react'
import { Eyebrow, Reveal } from './ui'

// KJV text (public domain), as FaithCast shows it.
const passages = [
  { typed: 'joh', book: 'John', ch: '3', v: '16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
  { typed: 'ps', book: 'Psalms', ch: '23', v: '1', text: 'The LORD is my shepherd; I shall not want.' },
  { typed: 'isa', book: 'Isaiah', ch: '40', v: '31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
  { typed: 'ro', book: 'Romans', ch: '8', v: '28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' }
]

type Frame = { book: string; done: boolean; ch: string; v: string; focus: 0 | 1 | 2; enter: boolean; live: boolean; ms: number }

function framesFor(p: (typeof passages)[number]): Frame[] {
  const f: Frame[] = []
  const base = { book: '', done: false, ch: '', v: '', focus: 0 as const, enter: false, live: false }
  for (let i = 1; i <= p.typed.length; i++) f.push({ ...base, book: p.typed.slice(0, i), ms: 140 })
  f.push({ ...base, book: p.book, done: true, focus: 1, ms: 420 })
  for (let i = 1; i <= p.ch.length; i++) f.push({ ...base, book: p.book, done: true, ch: p.ch.slice(0, i), focus: 1, ms: 160 })
  for (let i = 1; i <= p.v.length; i++) f.push({ ...base, book: p.book, done: true, ch: p.ch, v: p.v.slice(0, i), focus: 2, ms: 160 })
  f.push({ ...base, book: p.book, done: true, ch: p.ch, v: p.v, focus: 2, enter: true, ms: 380 })
  f.push({ ...base, book: p.book, done: true, ch: p.ch, v: p.v, focus: 2, live: true, ms: 4200 })
  return f
}

export function ScriptureDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-20% 0px' })
  const reduce = useReducedMotion()
  const timeline = useMemo(() => passages.flatMap((p, pi) => framesFor(p).map((fr) => ({ ...fr, pi }))), [])
  const lastLive = timeline.findIndex((f) => f.live)
  const [i, setI] = useState(lastLive)

  useEffect(() => {
    if (!inView || reduce) return
    const t = setTimeout(() => setI((n) => (n + 1) % timeline.length), timeline[i].ms)
    return () => clearTimeout(t)
  }, [i, inView, reduce, timeline])

  const fr = timeline[i]
  // the screen keeps showing the last passage until the next one goes live
  const showing = fr.live ? fr.pi : (fr.pi + passages.length - 1) % passages.length
  const p = passages[showing]

  return (
    <section id="bible" className="relative overflow-x-clip py-20 sm:py-28">
      <div aria-hidden className="absolute top-1/3 -right-40 -z-10 size-[700px] rounded-full bg-[radial-gradient(closest-side,rgb(42_116_245/0.12),transparent)] blur-2xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <Eyebrow>Scripture, instantly</Eyebrow>
          <h2 className="display mt-6 text-5xl sm:text-6xl lg:text-7xl">
            Type it. <span className="accent-italic">It&rsquo;s on screen.</span>
          </h2>
          <p className="mt-6 text-lg text-pretty text-muted">
            The preacher says &ldquo;turn with me to John 3:16&rdquo;. You type <kbd className="rounded-md border border-ink/15 bg-ink/5 px-1.5 py-0.5 font-mono text-sm text-ink">joh3:16</kbd>, press Enter, and the
            verse is up before the pages stop turning.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {[
              { icon: Keyboard, title: 'Book autocompletes', body: 'joh gives John, ps gives Psalms, 1 co gives 1 Corinthians.' },
              { icon: MousePointerClick, title: 'Click a verse to present', body: 'Then press → for the next verse. Shift-click for a range.' },
              { icon: Library, title: '14 English Bibles included', body: 'KJV, BSB, ASV, WEB and more. Switch versions in one click.' },
              { icon: Search, title: 'Search by words', body: 'Can’t remember the reference? Search “shepherd” or “living water”.' }
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-blue/15 text-sky">
                  <Icon className="size-4.5" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="mt-1 block text-[15px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15}>
          <div ref={ref} className="relative">
            {/* the operator's input, as in the app */}
            <div className="card relative z-10 mx-auto -mb-8 w-[92%] rounded-2xl p-3 shadow-2xl backdrop-blur sm:p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-dim uppercase">
                <BookOpen className="size-3.5" /> Bible · KJV
              </div>
              <div className="mt-3 flex items-stretch gap-2 font-medium">
                <Field value={fr.book} placeholder="Book" focused={fr.focus === 0} grow ghost={!fr.done && fr.book ? passages[fr.pi].book.slice(fr.book.length) : ''} />
                <Field value={fr.ch} placeholder="Ch" focused={fr.focus === 1} />
                <span className="self-center text-dim">:</span>
                <Field value={fr.v} placeholder="Verse" focused={fr.focus === 2} />
                <motion.span
                  animate={fr.enter ? { scale: [1, 0.9, 1], backgroundColor: ['rgb(42 116 245 / 0.15)', 'rgb(42 116 245 / 1)', 'rgb(42 116 245 / 0.15)'] } : {}}
                  transition={{ duration: 0.35 }}
                  className="grid w-11 shrink-0 place-items-center rounded-lg bg-blue/15 text-sky"
                  aria-hidden
                >
                  <CornerDownLeft className="size-4" />
                </motion.span>
              </div>
            </div>

            {/* the projector */}
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-ink/10 bg-black shadow-[0_40px_100px_-30px_rgb(11_60_160/0.45)]">
              <video src="/media/motion-loop.webm" autoPlay muted loop playsInline aria-hidden className="absolute inset-0 size-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a2a8a]/40 via-transparent to-black/50" />
              <AnimatePresence mode="wait">
                <motion.figure
                  key={showing}
                  initial={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col items-center justify-center px-[8%] pt-8 text-center"
                >
                  <blockquote className={`font-semibold text-balance text-white [text-shadow:0_2px_18px_rgb(11_21_51/0.12)] ${p.text.length > 110 ? 'text-base sm:text-2xl' : 'text-xl sm:text-3xl'}`}>
                    {p.text}
                  </blockquote>
                  <figcaption className="mt-4 text-xs text-white/75 sm:text-sm">
                    {p.book === 'Psalms' ? 'Psalm' : p.book} {p.ch}:{p.v} (KJV)
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-white/90 backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Field({ value, placeholder, focused, grow, ghost }: { value: string; placeholder: string; focused: boolean; grow?: boolean; ghost?: string }) {
  return (
    <span
      className={`relative flex h-11 items-center rounded-lg border px-3 text-[15px] transition-colors ${grow ? 'min-w-0 flex-1' : 'w-16 justify-center sm:w-20'} ${
        focused ? 'border-blue bg-blue/10 ring-4 ring-blue/15' : 'border-ink/10 bg-ink/[0.03]'
      }`}
    >
      {value ? <span className="text-ink">{value}</span> : <span className="text-dim">{placeholder}</span>}
      {focused && <span className="mx-px h-5 w-px animate-pulse bg-sky" />}
      {ghost && <span className="text-dim">{ghost}</span>}
    </span>
  )
}
