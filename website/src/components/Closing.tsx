'use client'

import { motion } from 'motion/react'
import { nav } from '@/lib/site'
import { DownloadButton } from './DownloadButton'
import { Logo, Reveal } from './ui'

export function FinalCta() {
  return (
    <section className="noise relative isolate overflow-hidden py-32 sm:py-44">
      <div aria-hidden className="absolute inset-0 -z-10">
        <motion.div
          initial={{ opacity: 0, scaleY: 0.4 }}
          whileInView={{ opacity: 1, scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '50% 0%' }}
          className="absolute top-0 left-1/2 h-full w-[900px] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_160deg,rgb(42_116_245/0.10)_172deg,rgb(42_116_245/0.20)_180deg,rgb(42_116_245/0.10)_188deg,transparent_200deg)] blur-2xl"
        />
        <div className="absolute bottom-[-30%] left-1/2 h-[500px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(42_116_245/0.18),transparent)] blur-3xl" />
      </div>
      <Reveal className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="display text-6xl text-balance sm:text-7xl lg:text-8xl">
          Let the Word <span className="accent-italic">shine</span> this Sunday
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted">Download FaithCast free and have your first service ready tonight.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DownloadButton />
          <a href="#download" className="inline-flex h-13 items-center rounded-full border border-ink/15 px-7 font-semibold transition hover:border-ink/30 hover:bg-ink/[0.03]">
            All downloads
          </a>
        </div>
      </Reveal>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line pt-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-[15px] text-muted">Free worship presentation software for churches of every size, on Windows and Mac.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-3 text-[15px]">
          {[...nav, { label: 'Download', href: '/#download' }].map((n) => (
            <a key={n.href} href={n.href} className="text-muted transition hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-14 max-w-6xl px-4 text-sm text-dim sm:px-6">© 2026 FaithCast. Made for the Church.</p>
      <div aria-hidden className="pointer-events-none mt-6 overflow-hidden select-none">
        <p className="display translate-y-[22%] bg-gradient-to-b from-ink/[0.09] via-blue/[0.12] to-transparent bg-clip-text text-center text-[25vw] leading-[0.8] text-transparent">FaithCast</p>
      </div>
    </footer>
  )
}
