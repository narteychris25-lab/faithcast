'use client'

import { motion, useMotionTemplate, useMotionValue } from 'motion/react'
import { SectionHeading } from './ui'

const roles = [
  { tag: 'Pastors & preachers', body: 'Preach without looking back at the screen. Your scripture and sermon points appear the moment you need them.' },
  { tag: 'Media & projection teams', body: 'One window for the whole service: what’s live, what’s next, and one key to go forward. No more scrambling.' },
  { tag: 'Worship leaders', body: 'Lyrics follow the band. Verse, chorus or bridge, the right slide is a click away, in the order you sing it.' },
  { tag: 'Volunteers', body: 'Never used it before? A demo service is ready on first launch, and big, clear buttons do the rest.' }
]

function RoleCard({ i, tag, body }: { i: number; tag: string; body: string }) {
  const mx = useMotionValue(-200)
  const my = useMotionValue(-200)
  const spotlight = useMotionTemplate`radial-gradient(380px circle at ${mx}px ${my}px, rgb(42 116 245 / 0.07), transparent 70%)`
  return (
    <motion.li
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(e.clientX - r.left)
        my.set(e.clientY - r.top)
      }}
      className="card group relative flex min-h-80 flex-col overflow-hidden rounded-3xl p-7 transition-colors hover:border-blue/30"
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: spotlight }} />
      <span className="relative w-fit rounded-full border border-blue/30 bg-blue/10 px-4 py-1.5 text-sm text-sky">{tag}</span>
      <span
        aria-hidden
        className="display pointer-events-none absolute -right-2 -bottom-10 text-[11rem] leading-none text-transparent [-webkit-text-stroke:1px_rgb(11_21_51/0.10)] transition duration-700 group-hover:[-webkit-text-stroke:1px_rgb(42_116_245/0.45)] bg-gradient-to-b from-blue/[0.06] to-transparent bg-clip-text"
      >
        {i + 1}
      </span>
      <p className="relative mt-auto max-w-[19rem] text-lg leading-relaxed text-ink/90">{body}</p>
    </motion.li>
  )
}

export function Audience() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Built for your whole team"
          title={<>Made for everyone <span className="accent-italic">behind the message</span></>}
          intro="From the pulpit to the back of the room, FaithCast keeps the service flowing, so nothing is lost between what’s said and what’s seen."
        />
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r, i) => (
            <RoleCard key={r.tag} i={i} {...r} />
          ))}
        </ul>
      </div>
    </section>
  )
}
