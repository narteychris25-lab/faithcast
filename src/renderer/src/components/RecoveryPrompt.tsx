import { useEffect, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import type { RecoveryInfo } from '@shared/types'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { useApp } from '@/stores/app'
import { useService } from '@/stores/service'
import { useLive } from '@/stores/live'
import { Button } from './ui/controls'
import { Modal, toast } from './ui/overlays'

/** After a crash: offer to resume the presentation and restore unsaved drafts. */
export function RecoveryPrompt() {
  const [info, setInfo] = useState<RecoveryInfo | null>(null)
  useEffect(() => {
    void api('app:recovery').then((r) => {
      if (r.crashed && (r.lastLive || r.drafts.length)) setInfo(r)
      else if (r.crashed) void api('app:clearRecovery')
    })
  }, [])
  if (!info) return null

  const dismiss = () => {
    setInfo(null)
    void api('app:clearRecovery')
  }

  async function resume() {
    const snap = info!.lastLive!
    useApp.getState().openService(snap.serviceId, 'live')
    await useService.getState().load(snap.serviceId)
    setInfo(null)
    void api('app:clearRecovery')
    const item = useService.getState().service?.items.find((i) => i.id === snap.itemId)
    if (item) await useLive.getState().goLive(item, snap.slideIndex)
    await useLive.getState().startOutput()
    toast.success(item ? 'Presentation resumed where it stopped.' : 'Service reopened in the Live view.')
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title={
        <span className="flex items-center gap-2">
          <LifeBuoy size={16} className="text-warn" /> WorshipFlow recovered from an unexpected shutdown
        </span>
      }
      footer={
        <>
          <Button onClick={dismiss}>Dismiss</Button>
          {info.lastLive && (
            <Button variant="live" onClick={() => void resume()}>
              Resume presentation
            </Button>
          )}
        </>
      }
    >
      <p className="mb-3 text-[13px] text-muted">All saved services, songs and media are intact.</p>
      {info.lastLive && (
        <p className="mb-3 text-[13px]">
          A presentation was live {relativeTime(info.lastLive.at)} (slide {info.lastLive.slideIndex + 1}). You can resume exactly where it stopped.
        </p>
      )}
      {info.drafts.length > 0 && (
        <div className="text-[13px]">
          Unsaved edits were recovered and will be offered when you open them:
          <ul className="mt-1 list-disc pl-5 text-muted">
            {info.drafts.map((d) => (
              <li key={d.key}>{d.label}</li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
