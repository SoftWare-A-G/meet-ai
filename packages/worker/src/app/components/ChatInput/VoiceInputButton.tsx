import clsx from 'clsx'
import { IconMicrophone } from '../../icons'

interface VoiceInputButtonProps {
  isListening: boolean
  onToggle: () => void
}

export default function VoiceInputButton({ isListening, onToggle }: VoiceInputButtonProps) {
  return (
    <button
      type="button"
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      className={clsx(
        'h-9 w-9 rounded-lg border flex items-center justify-center cursor-pointer text-sm transition-all',
        isListening
          ? 'bg-[#F85149]/20 border-[#F85149]/50 text-[#F85149] animate-pulse'
          : 'border-border bg-transparent text-msg-text opacity-70 hover:opacity-100 hover:bg-white/5'
      )}
      onMouseDown={e => e.preventDefault()}
      onClick={onToggle}
    >
      <IconMicrophone size={16} />
    </button>
  )
}
