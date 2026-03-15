import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export function parseUtcDate(isoStr: string): dayjs.Dayjs {
  return dayjs.utc(isoStr)
}

export function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  const d = dayjs.utc(isoStr).local()
  return d.isValid() ? d.format('HH:mm:ss') : ''
}

export function formatTimeWithSeconds(isoStr?: string): string {
  if (!isoStr) return ''
  const d = dayjs.utc(isoStr).local()
  return d.isValid() ? d.format('HH:mm:ss') : ''
}

export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now()
  const then = dayjs.utc(isoTimestamp).valueOf()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
