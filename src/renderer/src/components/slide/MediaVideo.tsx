import { useEffect, useRef, type CSSProperties } from 'react'
import { mediaUrl } from '@/lib/api'

export interface VideoHandle {
  mediaId: string
  el: HTMLVideoElement
}

interface Props {
  mediaId: string
  style: CSSProperties
  loop: boolean
  muted: boolean
  volume: number
  paused: boolean
  /** Load without starting playback (operator presses play). */
  startPaused?: boolean
  onHandle?: (h: VideoHandle | null) => void
  onError?: () => void
}

/**
 * A playing video. Streams through fcmedia:// (range requests), so large
 * files never load fully into memory. Releases its decoder on unmount.
 */
export function MediaVideo({ mediaId, style, loop, muted, volume, paused, startPaused, onHandle, onError }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    onHandle?.({ mediaId, el })
    return () => {
      onHandle?.(null)
      // Free the hardware decoder immediately rather than waiting for GC.
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.volume = Math.max(0, Math.min(1, volume))
    el.muted = muted
  }, [volume, muted])

  const first = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (first.current) {
      first.current = false
      if (startPaused) return
    }
    if (paused) el.pause()
    else void el.play().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  return (
    <video
      ref={ref}
      src={mediaUrl(mediaId)}
      style={style}
      autoPlay={!paused && !startPaused}
      loop={loop}
      muted={muted}
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={onError}
    />
  )
}
