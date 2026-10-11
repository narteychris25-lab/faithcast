'use client'

import { MotionConfig } from 'motion/react'

/** Honour the visitor's "reduce motion" setting across every animation. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
