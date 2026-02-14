import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export function parseUtcDate(isoStr: string): dayjs.Dayjs {
  return dayjs.utc(isoStr)
}

export function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  const d = dayjs.utc(isoStr).local()
  return d.isValid() ? d.format('HH:mm') : ''
}

export function formatTimeWithSeconds(isoStr?: string): string {
  if (!isoStr) return ''
  const d = dayjs.utc(isoStr).local()
  return d.isValid() ? d.format('HH:mm:ss') : ''
}
