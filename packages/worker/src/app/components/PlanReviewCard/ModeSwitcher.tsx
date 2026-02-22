import type { ReactNode } from 'react'
import clsx from 'clsx'

export type EditorMode = 'selection' | 'comment' | 'redline'

type ModeSwitcherProps = {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}

const modes: { value: EditorMode; label: string; icon: ReactNode }[] = [
  {
    value: 'selection',
    label: 'Select',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047 -1.047a1.067 1.067 0 0 0 0 -1.509l-4.907 -4.907l3.113 -2.09a1.2 1.2 0 0 0 -.309 -2.228l-13.582 -3.904l3.904 13.563" />
      </svg>
    ),
  },
  {
    value: 'comment',
    label: 'Comment',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9h8" />
        <path d="M8 13h6" />
        <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12" />
      </svg>
    ),
  },
  {
    value: 'redline',
    label: 'Redline',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l14 0" />
        <path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5" />
      </svg>
    ),
  },
]

export default function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="mb-2 flex items-center gap-0.5 rounded-lg bg-zinc-700 p-0.5 w-fit">
      {modes.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={clsx(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
            mode === value
              ? 'bg-zinc-800 text-zinc-200 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-300',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  )
}
