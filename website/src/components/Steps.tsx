'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { ListPlus, Cable, Presentation } from 'lucide-react'
import { ProjectedSlide } from './Hero'
import { AppWindow, SectionHeading } from './ui'

const steps = [
  { icon: ListPlus, title: 'Plan', body: 'Add songs, scripture, media and announcements to your service. A demo service is waiting the first time you open FaithCast.' },
  { icon: Cable, title: 'Connect', body: 'Plug the projector or TV into your computer. FaithCast shows the slides there and keeps the controls on your screen.' },
  { icon: Presentation, title: 'Present', body: 'Press Present, then → or Space to move through the service. That’s it.' }
]

function Step({ i, progress, step }: { i: number; progress: MotionValue<number>; step: (typeof steps)[number] }) {
  const at = i / steps.length
  const lit = useTransform(progress, [at, at + 0.12], [0, 1])
  const bg = useTransform(lit, (v) => `rgb(42 116 245 / ${0.12 + v * 0.88})`)
  const color = useTransform(lit, (v) => (v > 0.5 ? '#ffffff' : '#2a74f5'))
  const glow = useTransform(lit, (v) => `0 0 ${v * 40}px ${v * 2}px rgb(42 116 245 / ${v * 0.35})`)
  const textOpacity = useTransform(lit, [0, 1], [0.45, 1])
  return (
    <li className="relative flex gap-6 pb-16 last:pb-0">
      <motion.span style={{ backgroundColor: bg, boxShadow: glow, color }} className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl">
        <step.icon className="size-6" />
      </motion.span>
      <motion.div style={{ opacity: textOpacity }} className="pt-1">
        <span className="text-sm font-semibold tracking-widest text-sky uppercase">Step {i + 1}</span>
        <h3 className="display mt-1 text-4xl text-ink">{step.title}</h3>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{step.body}</p>
      </motion.div>
    </li>
  )
}

export function Steps() {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] })
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section id="how" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title={<>From download to <span className="accent-italic">first slide</span> in minutes</>}
        />
        <div className="mt-20 grid items-center gap-16 lg:grid-cols-2">
          <ol ref={ref} className="relative">
            <span aria-hidden className="absolute top-2 bottom-2 left-7 w-px bg-ink/10" />
            <motion.span aria-hidden style={{ height: fill }} className="absolute top-2 left-7 w-px bg-gradient-to-b from-sky to-blue" />
            {steps.map((s, i) => (
              <Step key={s.title} i={i} step={s} progress={scrollYProgress} />
            ))}
          </ol>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <AppWindow src="/screens/planner.jpg" alt="Planning a Sunday service in FaithCast" />
            <div className="absolute -bottom-10 -left-4 w-1/2 animate-float sm:-left-10">
              <ProjectedSlide src="/screens/slide-song.jpg" label="on the projector" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
