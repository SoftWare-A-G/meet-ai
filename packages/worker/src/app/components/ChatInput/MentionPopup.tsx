import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { ensureSenderContrast } from '../../lib/colors'
import type { TeamMember } from '../../lib/types'

type MentionPopupProps = {
  agents: TeamMember[]
  selectedIndex: number
  onSelect: (agent: TeamMember) => void
}

export default function MentionPopup({ agents, selectedIndex, onSelect }: MentionPopupProps) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (agents.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto rounded-lg border border-border bg-input-bg shadow-lg z-50">
      {agents.map((agent, i) => (
        <button
          key={agent.name}
          ref={i === selectedIndex ? selectedRef : undefined}
          type="button"
          className={clsx(
            'flex items-center gap-2 w-full px-3 py-2 text-sm text-msg-text text-left bg-transparent border-none cursor-pointer hover:bg-white/10',
            i === selectedIndex && 'bg-white/10'
          )}
          onMouseDown={e => {
            e.preventDefault()
            onSelect(agent)
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: ensureSenderContrast(agent.color) }}
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{agent.name}</span>
        </button>
      ))}
    </div>
  )
}
