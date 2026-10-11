'use client'

import Image from 'next/image'
import { motion, type HTMLMotionProps } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

/** Fades, lifts and un-blurs its children the first time they scroll into view. */
export function Reveal({ delay = 0, y = 28, className, children, ...rest }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, delay, ease }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-blue/30 bg-blue/10 px-4 py-1.5 text-sm text-sky">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-blue" />
      </span>
      {children}
    </span>
  )
}

export function SectionHeading({ eyebrow, title, intro, className = '' }: { eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; className?: string }) {
  return (
    <Reveal className={`mx-auto flex max-w-3xl flex-col items-center text-center ${className}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display mt-6 text-5xl text-balance sm:text-6xl lg:text-7xl">{title}</h2>
      {intro && <p className="mt-6 max-w-2xl text-lg text-pretty text-muted">{intro}</p>}
    </Reveal>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/brand/mark.png" alt="" width={991} height={1024} className="h-7 w-auto" preload />
      <span className="text-xl font-bold tracking-tight">
        Faith<span className="text-blue">Cast</span>
      </span>
    </span>
  )
}

/** A Mac-style window frame around an app screenshot. */
export function AppWindow({ src, alt, className = '', preload = false }: { src: string; alt: string; className?: string; preload?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-ink/10 bg-white shadow-[0_2px_4px_rgb(11_21_51/0.04),0_40px_100px_-30px_rgb(11_60_160/0.35)] ${className}`}>
      <div className="flex h-7 items-center gap-1.5 border-b border-ink/5 bg-[#f3f5f9] px-3 sm:h-8">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <Image src={src} alt={alt} width={2880} height={1590} sizes="(min-width: 1280px) 1200px, 100vw" className="block h-auto w-full" preload={preload} />
    </div>
  )
}
