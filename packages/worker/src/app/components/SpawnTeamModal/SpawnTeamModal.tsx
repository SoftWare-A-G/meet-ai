import { Dialog } from '@base-ui/react'
import clsx from 'clsx'
import { useState, useCallback } from 'react'
import { IconLoader } from '../../icons'

type SpawnTeamModalProps = {
  onClose: () => void
  onSend: (data: object) => void
}

export default function SpawnTeamModal({ onClose, onSend }: SpawnTeamModalProps) {
  const [roomName, setRoomName] = useState('')
  const [sending, setSending] = useState(false)

  const handleSpawn = useCallback(() => {
    const name = roomName.trim()
    if (!name || sending) return

    setSending(true)
    onSend({ type: 'spawn_request', room_name: name })
    // Close after a brief delay so the user sees "Spawning..."
    setTimeout(onClose, 400)
  }, [roomName, sending, onSend, onClose])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !sending) {
        e.preventDefault()
        handleSpawn()
      }
    },
    [handleSpawn, sending]
  )

  return (
    <Dialog.Root open onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/50" />
        <Dialog.Popup className="bg-chat-bg text-msg-text border-border fixed top-1/2 left-1/2 z-100 w-115 max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6">
          <Dialog.Title className="mb-4 text-lg">Spawn Team</Dialog.Title>
          <label className="mb-1 block text-[13px] font-semibold">Room Name</label>
          <input
            className="border-border text-msg-text mb-3 w-full rounded-md border bg-white/10 px-2.5 py-2 text-base"
            type="text"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. my-feature-team"
            autoFocus
            disabled={sending}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-msg-text border-border cursor-pointer rounded-md border bg-transparent px-4 py-2 text-[13px] font-semibold"
              onClick={onClose}
              disabled={sending}>
              Cancel
            </button>
            <button
              type="button"
              className={clsx(
                'bg-primary text-primary-text rounded-md border-none px-4 py-2 text-[13px] font-semibold',
                sending ? 'cursor-wait opacity-70' : 'cursor-pointer'
              )}
              onClick={handleSpawn}
              disabled={sending || !roomName.trim()}>
              {sending ? (
                <span className="flex items-center gap-1.5">
                  <IconLoader size={14} className="animate-spin" />
                  Spawning...
                </span>
              ) : (
                'Spawn'
              )}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
