import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { IconLoader } from '../../icons'
import { CODING_AGENT_OPTIONS, type CodingAgentId } from '../../lib/coding-agents'

type SpawnTeamModalProps = {
  onClose: () => void
  onSend: (data: object) => void
}

export default function SpawnTeamModal({ onClose, onSend }: SpawnTeamModalProps) {
  const [roomName, setRoomName] = useState('')
  const [codingAgent, setCodingAgent] = useState<CodingAgentId>('claude')
  const [sending, setSending] = useState(false)

  const handleSpawn = useCallback(() => {
    const name = roomName.trim()
    if (!name || sending) return

    setSending(true)
    onSend({ type: 'spawn_request', room_name: name, coding_agent: codingAgent })
    // Close after a brief delay so the user sees "Spawning..."
    setTimeout(onClose, 400)
  }, [codingAgent, roomName, sending, onSend, onClose])

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
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="w-115 max-w-[90vw] sm:max-w-115 p-6" showCloseButton={false}>
        <DialogTitle className="mb-4 text-lg">Spawn Team</DialogTitle>
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
        <label className="mb-1 block text-[13px] font-semibold">Coding Agent</label>
        <select
          className="border-border text-msg-text mb-3 w-full rounded-md border bg-white/10 px-2.5 py-2 text-base"
          value={codingAgent}
          onChange={e => setCodingAgent(e.target.value as CodingAgentId)}
          disabled={sending}>
          {CODING_AGENT_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sending}>
            Cancel
          </Button>
          <Button
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
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
