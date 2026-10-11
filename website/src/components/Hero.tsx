'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { Check, Play } from 'lucide-react'
import { DownloadButton } from './DownloadButton'
import { AppWindow, Eyebrow } from './ui'

const ease = [0.22, 1, 0.36, 1] as const
const line1 = ['Put', 'the', 'Word', 'on', 'screen,']
const line2 = ['without', 'the', 'Sunday', 'stress']

function Words({ words, start, className = '' }: { words: string[]; start: number; className?: string }) {
  return words.map((w, i) => (
    <motion.span
      key={w + i}
      initial={{ opacity: 0, y: '0.5em', filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, delay: start + i * 0.07, ease }}
      className={`inline-block ${className}`}
    >
      {w}
      {i < words.length - 1 && ' '}
    </motion.span>
  ))
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const rotateX = useTransform(scrollYProgress, [0, 0.45], [24, 0])
  const scale = useTransform(scrollYProgress, [0, 0.45], [0.9, 1])
  const y = useTransform(scrollYProgress, [0, 0.45], [0, -40])
  const beam = useTransform(scrollYProgress, [0, 0.5], [1, 0.35])
  const leftX = useTransform(scrollYProgress, [0, 0.5], [0, -60])
  const rightX = useTransform(scrollYProgress, [0, 0.5], [0, 60])

  return (
    <section id="top" ref={ref} className="noise relative isolate overflow-hidden pt-36 pb-24 sm:pt-44">
      {/* light from above */}
      <div aria-hidden className="grid-bg absolute inset-0 -z-10" />
      <motion.div aria-hidden style={{ opacity: beam }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px]">
        <div className="absolute top-[-200px] left-1/2 h-[900px] w-[1200px] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_155deg,rgb(42_116_245/0.10)_170deg,rgb(42_116_245/0.20)_180deg,rgb(42_116_245/0.10)_190deg,transparent_205deg)] blur-2xl" />
        <div className="absolute top-[420px] left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(42_116_245/0.22),transparent)] blur-3xl" />
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
          <Eyebrow>Free for Windows &amp; Mac · Works offline</Eyebrow>
        </motion.div>

        <h1 className="display mx-auto mt-8 max-w-5xl text-[3.4rem] sm:text-7xl lg:text-[6.2rem]">
          <Words words={line1} start={0.15} />
          <br />
          <Words words={line2} start={0.5} className="accent-italic" />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9, ease }}
          className="mx-auto mt-8 max-w-2xl text-lg text-pretty text-muted sm:text-xl"
        >
          FaithCast is worship presentation software anyone in the media booth can run. Lyrics, scripture, videos and announcements, all from one calm, simple app.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.05, ease }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <DownloadButton />
          <a
            href="#how"
            className="inline-flex h-13 items-center gap-2 rounded-full border border-ink/15 px-7 font-semibold text-ink transition hover:border-ink/30 hover:bg-ink/[0.03]"
          >
            <Play className="size-4 fill-current" />
            See how it works
          </a>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-dim"
        >
          {['Free, no subscription', 'No account needed', 'No internet needed on Sunday'].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="size-4 text-blue" />
              {t}
            </li>
          ))}
        </motion.ul>
      </div>

      {/* the app, tilting upright as you scroll */}
      <div className="relative mx-auto mt-20 max-w-6xl px-4 sm:px-6" style={{ perspective: 1600 }}>
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.3, delay: 0.6, ease }}
        >
          <motion.div style={{ rotateX, scale, y, transformOrigin: '50% 0%' }}>
            <AppWindow src="/screens/live.jpg" alt="FaithCast live view presenting Amazing Grace, with the live and next slides on the right" preload />
          </motion.div>
        </motion.div>

        <motion.div
          aria-hidden
          style={{ x: leftX }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.2, delay: 1.2, ease }}
          className="absolute top-[22%] -left-4 hidden w-[23%] lg:block xl:-left-32"
        >
          <div className="animate-float [transform:perspective(900px)_rotateY(18deg)_rotateZ(-4deg)]">
            <ProjectedSlide src="/screens/slide-verse.jpg" label="John 3:16 · on screen" />
          </div>
        </motion.div>
        <motion.div
          aria-hidden
          style={{ x: rightX }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.2, delay: 1.35, ease }}
          className="absolute top-[58%] -right-4 hidden w-[22%] lg:block xl:-right-32"
        >
          <div className="animate-float [animation-delay:-3s] [transform:perspective(900px)_rotateY(-18deg)_rotateZ(3deg)]">
            <ProjectedSlide src="/screens/slide-song.jpg" label="Amazing Grace · verse 1" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function ProjectedSlide({ src, label }: { src: string; label: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_30px_80px_-20px_rgb(11_21_51/0.35)]">
      <Image src={src} alt="" width={1600} height={900} sizes="400px" className="block w-full rounded-xl" />
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-xs text-muted">
        <span className="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgb(239_68_68/0.7)]" />
        LIVE · {label}
      </div>
    </div>
  )
}
