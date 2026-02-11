import { useState } from 'hono/jsx/dom'
import { hashColor, ensureSenderContrast } from '../../../lib/colors'

type LogEntry = {
  sender: string
  content: string
  color?: string
  created_at: string
}

type LogGroupProps = {
  logs: LogEntry[]
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
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

  const firstTime = formatTime(logs[0].created_at)
  const lastTime = logs.length > 1 ? formatTime(logs[logs.length - 1].created_at) : null
  const timeRange = lastTime && lastTime !== firstTime ? `${firstTime} - ${lastTime}` : firstTime

  return (
    <div class="log-group">
      <div class="log-group-header" onClick={() => setExpanded(!expanded)}>
        <span class="log-group-toggle">{expanded ? '\u25BE' : '\u25B8'}</span>
        <span class="log-group-summary">{summaryText(logs)}</span>
        <span class="log-group-time">{timeRange}</span>
      </div>
      {expanded && (
        <div class="log-group-entries">
          {logs.map((log, i) => {
            const senderColor = log.color ? ensureSenderContrast(log.color) : hashColor(log.sender)
            return (
              <div class="log-entry" key={`${log.sender}-${log.created_at}-${i}`}>
                <span class="log-entry-time">{formatTime(log.created_at)}</span>
                <span class="log-entry-sender" style={`color:${senderColor}`}>{log.sender}:</span>
                <span class="log-entry-content">{log.content}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
