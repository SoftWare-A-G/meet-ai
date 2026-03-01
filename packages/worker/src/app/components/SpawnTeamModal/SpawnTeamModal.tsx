import { Dialog } from '@base-ui/react'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useState, useCallback } from 'react'
import { IconLoader } from '../../icons'
import * as api from '../../lib/api'
import { useChatContext } from '../../lib/chat-context'

type SpawnTeamModalProps = {
  onClose: () => void
  onRoomCreated?: () => void
}

export default function SpawnTeamModal({ onClose, onRoomCreated }: SpawnTeamModalProps) {
  const { userName } = useChatContext()
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSpawn = useCallback(async () => {
    const name = roomName.trim()
    if (!name) {
      setError('Room name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Create the room
      const createRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getApiKey()}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!createRes.ok) throw new Error(`Failed to create room: HTTP ${createRes.status}`)
      const newRoom: { id: string } = await createRes.json()

      // 2. Send spawn_request as a message to the new room
      const spawnRequest = JSON.stringify({
        type: 'spawn_request',
        room_name: name,
        prompt: 'You are a team lead. Coordinate with your teammates to complete the task.',
      })
      await api.sendMessage(newRoom.id, userName, spawnRequest)

      // 3. Navigate to the new room
      onRoomCreated?.()
      onClose()
      navigate({ to: '/chat/$id', params: { id: newRoom.id } })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to spawn team')
    } finally {
      setLoading(false)
    }
  }, [roomName, userName, navigate, onClose, onRoomCreated])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        e.preventDefault()
        handleSpawn()
      }
    },
    [handleSpawn, loading]
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
            disabled={loading}
          />
          {error && <p className="mb-3 text-[13px] text-[#F85149]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-msg-text border-border cursor-pointer rounded-md border bg-transparent px-4 py-2 text-[13px] font-semibold"
              onClick={onClose}
              disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className={clsx(
                'bg-primary text-primary-text rounded-md border-none px-4 py-2 text-[13px] font-semibold',
                loading ? 'cursor-wait opacity-70' : 'cursor-pointer'
              )}
              onClick={handleSpawn}
              disabled={loading}>
              {loading ? (
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
