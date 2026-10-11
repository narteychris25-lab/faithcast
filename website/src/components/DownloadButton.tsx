'use client'

import { useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { downloads } from '@/lib/site'

type Detected = 'windows' | 'mac' | 'other'

export function useDetectedOS(): Detected {
  const [os, setOs] = useState<Detected>('other')
  useEffect(() => {
    const ua = navigator.userAgent
    if (/Windows/i.test(ua)) setOs('windows')
    else if (/Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) setOs('mac')
  }, [])
  return os
}

/**
 * The main call to action. On Windows it downloads the installer straight away;
 * on a Mac (where Apple silicon vs Intel can't be detected reliably) and on phones
 * it scrolls to the download section to pick the right file.
 */
export function DownloadButton({ size = 'lg', className = '' }: { size?: 'md' | 'lg'; className?: string }) {
  const os = useDetectedOS()
  const label = os === 'windows' ? 'Download for Windows' : os === 'mac' ? 'Download for Mac' : 'Download free'
  const href = os === 'windows' ? downloads.windows.href : '#download'
  const pad = size === 'lg' ? 'h-13 px-7 text-base' : 'h-10 px-5 text-sm'
  return (
    <a
      href={href}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-blue font-semibold text-white shadow-[0_10px_30px_-10px_rgb(42_116_245/0.7)] transition hover:bg-[#3b82ff] hover:shadow-[0_14px_40px_-10px_rgb(42_116_245/0.85)] active:scale-[0.98] ${pad} ${className}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <ArrowDown className="size-4 transition group-hover:translate-y-0.5" />
      {label}
    </a>
  )
}
