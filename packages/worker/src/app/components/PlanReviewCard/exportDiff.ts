import { sortByPosition, type Annotation } from './annotations'

export function exportDiff(annotations: Annotation[]): string {
  const sorted = sortByPosition(annotations)
  if (sorted.length === 0) return ''

  const lines: string[] = [
    '# Plan Feedback',
    '',
    `I've reviewed this plan and have ${sorted.length} piece${sorted.length === 1 ? '' : 's'} of feedback:`,
    '',
  ]

  for (let i = 0; i < sorted.length; i++) {
    const ann = sorted[i]
    const num = i + 1

    switch (ann.type) {
      case 'DELETION':
        lines.push(`## ${num}. Remove this`)
        lines.push('```')
        lines.push(ann.originalText)
        lines.push('```')
        if (ann.text) {
          lines.push(`> ${ann.text}`)
        }
        break

      case 'REPLACEMENT':
        lines.push(`## ${num}. Change this`)
        lines.push(`**From:** ${ann.originalText}`)
        lines.push(`**To:** ${ann.text ?? ''}`)
        break

      case 'COMMENT':
        lines.push(`## ${num}. Feedback on: "${ann.originalText}"`)
        lines.push(`> ${ann.text ?? ''}`)
        break
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
