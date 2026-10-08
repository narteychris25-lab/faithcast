import { Pause, Play, Repeat, RotateCcw, Square, Volume2, VolumeX, Music2, Film } from 'lucide-react'
import { DEFAULT_MEDIA_SETTINGS } from '@shared/defaults'
import { duration } from '@/lib/format'
import { useLive } from '@/stores/live'
import { useAudio } from '@/stores/audio'
import { IconButton } from '@/components/ui/controls'

/** Transport for a live foreground video (runs in the output window). */
export function VideoTransport() {
  const slide = useLive((s) => s.slides[s.slideIndex])
  const video = useLive((s) => s.video)
  const cmd = useLive((s) => s.video_)
  if (!slide?.media || slide.media.type !== 'video') return null
  const settings = { ...DEFAULT_MEDIA_SETTINGS, ...slide.media.settings }
  const muted = video.muted ?? settings.muted
  const dur = video.duration || 0
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-2.5">
      <div className="mb-1.5 flex items-center gap-2 text-[12px]">
        <Film size={14} className="text-rose-400" />
        <span className="flex-1 truncate font-medium">{slide.label}</span>
        {video.error && <span className="text-danger">{video.error}</span>}
      </div>
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={0.1}
        value={Math.min(video.currentTime, dur || 1)}
        onChange={(e) => cmd('seek', Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-[var(--color-live)]"
        aria-label="Seek video"
      />
      <div className="mt-1 flex items-center gap-1">
        <IconButton icon={video.playing ? Pause : Play} label={video.playing ? 'Pause video' : 'Play video'} onClick={() => cmd(video.playing ? 'pause' : 'play')} />
        <IconButton icon={RotateCcw} label="Restart video" onClick={() => cmd('restart')} />
        <IconButton icon={muted ? VolumeX : Volume2} label={muted ? 'Unmute' : 'Mute'} onClick={() => cmd(video.playing ? 'play' : 'pause', undefined, { muted: !muted })} />
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {duration(video.currentTime)} / {duration(dur)}
        </span>
      </div>
    </div>
  )
}

/** Visible indicator + controls for service audio. */
export function AudioPanel() {
  const a = useAudio()
  if (!a.mediaId) return null
  return (
    <div className="rounded-lg border border-audio/40 bg-audio/10 p-2.5" data-testid="audio-panel">
      <div className="mb-1.5 flex items-center gap-2 text-[12px]">
        <Music2 size={14} className={a.playing ? 'text-audio' : 'text-muted'} />
        <span className="flex-1 truncate font-medium">{a.title}</span>
        {a.error && <span className="text-danger">{a.error}</span>}
      </div>
      <input
        type="range"
        min={0}
        max={a.duration || 1}
        step={0.1}
        value={Math.min(a.currentTime, a.duration || 1)}
        onChange={(e) => a.seek(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-[var(--color-audio)]"
        aria-label="Seek audio"
      />
      <div className="mt-1 flex items-center gap-1">
        <IconButton icon={a.playing ? Pause : Play} label={a.playing ? 'Pause audio' : 'Play audio'} onClick={a.toggle} />
        <IconButton icon={Square} label="Stop audio (fades out if set)" onClick={() => a.stop(true)} />
        <IconButton icon={Repeat} label="Loop" active={a.loop} onClick={() => a.setLoop(!a.loop)} />
        <input type="range" min={0} max={1} step={0.01} value={a.volume} onChange={(e) => a.setVolume(Number(e.target.value))} className="h-1 w-20 cursor-pointer accent-[var(--color-audio)]" aria-label="Audio volume" />
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {duration(a.currentTime)} / {duration(a.duration)}
        </span>
      </div>
    </div>
  )
}
