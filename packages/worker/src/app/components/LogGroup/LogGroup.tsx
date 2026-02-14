import { useState } from 'react'
import { hashColor, ensureSenderContrast } from '../../lib/colors'
import { formatTimeWithSeconds } from '../../lib/dates'

type LogEntry = {
  sender: string
  content: string
  color?: string
  created_at: string
}

type LogGroupProps = {
  logs: LogEntry[]
}

function summaryText(logs: LogEntry[]): string {
  const senders = [...new Set(logs.map(l => l.sender))]
  const count = logs.length
  if (senders.length === 1) {
    return `${count} log ${count === 1 ? 'entry' : 'entries'} from ${senders[0]}`
  }
  return `${count} log entries from ${senders.length} agents`
}

export default function LogGroup({ logs }: LogGroupProps) {
  const [expanded, setExpanded] = useState(false)

  if (logs.length === 0) return null

  const firstTime = formatTimeWithSeconds(logs[0].created_at)
  const lastTime = logs.length > 1 ? formatTimeWithSeconds(logs[logs.length - 1].created_at) : null
  const timeRange = lastTime && lastTime !== firstTime ? `${firstTime} - ${lastTime}` : firstTime

  return (
    <div className="rounded my-px text-xs font-mono text-msg-text opacity-65">
      <div className="flex items-center gap-1.5 px-2 py-[3px] cursor-pointer rounded select-none hover:bg-white/[0.08] hover:opacity-100" onClick={() => setExpanded(!expanded)}>
        <span className="text-[10px] w-3 text-center shrink-0">{expanded ? '\u25BE' : '\u25B8'}</span>
        <span className="flex-1 min-w-0">{summaryText(logs)}</span>
        <span className="text-[11px] opacity-50 whitespace-nowrap">{timeRange}</span>
      </div>
      {expanded && (
        <div className="py-0 px-2 pb-1 pl-5">
          {logs.map((log, i) => {
            const senderColor = log.color ? ensureSenderContrast(log.color) : hashColor(log.sender)
            return (
              <div className="flex gap-1.5 py-px leading-snug text-xs" key={`${log.sender}-${log.created_at}-${i}`}>
                <span className="opacity-45 whitespace-nowrap shrink-0">{formatTimeWithSeconds(log.created_at)}</span>
                <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: senderColor }}>{log.sender}:</span>
                <span className="min-w-0 break-words">{log.content}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
