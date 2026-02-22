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
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.963a5.5 5.5 0 00-.358 7.2l-2.06 2.06a1 1 0 001.414 1.414l2.06-2.06a5.5 5.5 0 007.2-.358l.963.259a1 1 0 10.518-1.932l-.963-.259a5.5 5.5 0 00.358-7.2l2.06-2.06a1 1 0 00-1.414-1.414l-2.06 2.06a5.5 5.5 0 00-7.2.358l-.963-.259zm3.328 2.2a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    value: 'comment',
    label: 'Comment',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    value: 'redline',
    label: 'Redline',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 001.415-1.414l-.675-.675A9.001 9.001 0 003.707 2.293zM15.894 13.48l-1.431-1.432A7 7 0 008.95 5.537L7.519 4.106A8.96 8.96 0 0110 3.5c4.142 0 7.5 2.91 7.5 6.5 0 1.254-.43 2.44-1.194 3.43l-.412.05zM4.106 7.52C3.43 8.559 3 9.755 3 11c0 1.434.493 2.767 1.338 3.877L2 17l3.917-1.02A8.841 8.841 0 0010 17c.69 0 1.36-.072 2-.208l-1.431-1.431A7.08 7.08 0 0110 15.5c-3.314 0-6-2.239-6-5 0-.683.15-1.34.42-1.952l-.314-.028z" clipRule="evenodd" />
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
