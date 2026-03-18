import clsx from 'clsx'
import type { RefObject } from 'react'

interface MentionItem {
  id: string
  display: string
}

interface MentionDropdownProps {
  members: MentionItem[]
  selectedIndex: number
  itemRefs: RefObject<(HTMLButtonElement | null)[]>
  onSelect: (display: string) => void
}

export default function MentionDropdown({ members, selectedIndex, itemRefs, onSelect }: MentionDropdownProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-10 border border-border border-b-0 bg-input-bg shadow-xl rounded-t-lg overflow-hidden">
      <ul className="max-h-48 overflow-y-auto">
        {members.map((member, i) => (
          <li key={member.id}>
            <button
              ref={(el) => { itemRefs.current[i] = el }}
              type="button"
              className={clsx(
                'w-full text-left px-3 py-2 flex gap-2 items-baseline cursor-pointer border-none bg-transparent text-msg-text text-sm',
                i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
              )}
              onMouseDown={e => e.preventDefault()}
              onTouchStart={e => e.preventDefault()}
              onClick={() => onSelect(member.display)}
            >
              <span className="font-semibold shrink-0">@{member.display}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
