import type { CommandInfo } from '../../lib/types'

type SlashCommandBadgeProps = {
  commandName: string
  promptText: string
  commandType: CommandInfo['type']
}

export default function SlashCommandBadge({ commandName, promptText, commandType }: SlashCommandBadgeProps) {
  const isSkill = commandType === 'skill'
  const label = isSkill ? 'Skill' : 'Command'

  return (
    <div className="inline-flex items-baseline gap-1.5 flex-wrap">
      <span
        className={
          isSkill
            ? 'inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300 ring-1 ring-purple-500/25'
            : 'inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-500/25'
        }
      >
        <span>{label}</span>
        <span className="font-mono font-bold">{commandName}</span>
      </span>
      {promptText && (
        <span className="text-sm text-[#d1d5db]">{promptText}</span>
      )}
    </div>
  )
}
