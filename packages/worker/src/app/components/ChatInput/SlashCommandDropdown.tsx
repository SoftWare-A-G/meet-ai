import clsx from 'clsx'
import type { RefObject } from 'react'
import type { CommandItem } from '../../lib/fetchers'

interface SlashCommandDropdownProps {
  commands: CommandItem[]
  selectedIndex: number
  itemRefs: RefObject<(HTMLButtonElement | null)[]>
  onSelect: (name: string) => void
}

export default function SlashCommandDropdown({ commands, selectedIndex, itemRefs, onSelect }: SlashCommandDropdownProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-10 border border-border border-b-0 bg-input-bg shadow-xl rounded-t-lg overflow-hidden">
      <ul className="max-h-48 overflow-y-auto">
        {commands.map((cmd, i) => (
          <li key={cmd.name}>
            <button
              ref={(el) => { itemRefs.current[i] = el }}
              type="button"
              className={clsx(
                'w-full text-left px-3 py-2 flex gap-2 items-baseline cursor-pointer border-none bg-transparent text-msg-text text-sm',
                i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
              )}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onSelect(cmd.name)}
            >
              <span className="font-semibold shrink-0">/{cmd.name}</span>
              <span className="text-msg-text opacity-50 truncate">{cmd.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
