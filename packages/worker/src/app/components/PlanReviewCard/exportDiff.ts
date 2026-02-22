import { sortByPosition, type Annotation } from './annotations'

function escapeMarkdown(text: string): string {
  return text
    .replace(/`/g, '\\`')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\*\*/g, '\\*\\*')
    .replace(/(?<!\*)\*(?!\*)/g, '\\*')
    .replace(/(?<!_)_(?!_)/g, '\\_')
}

function escapeCodeBlock(text: string): string {
  return text.replace(/```/g, '\\`\\`\\`')
}

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
      case 'DELETION': {
        lines.push(`## ${num}. Remove this`)
        lines.push('```')
        lines.push(escapeCodeBlock(ann.originalText))
        lines.push('```')
        if (ann.text) {
          lines.push(`> ${ann.text}`)
        }
        break
      }

      case 'REPLACEMENT': {
        lines.push(`## ${num}. Change this`)
        lines.push(`**From:** ${escapeMarkdown(ann.originalText)}`)
        lines.push(`**To:** ${escapeMarkdown(ann.text ?? '')}`)
        break
      }

      case 'COMMENT': {
        const escapedOriginal = escapeMarkdown(ann.originalText).replace(/"/g, '\\"')
        lines.push(`## ${num}. Feedback on: "${escapedOriginal}"`)
        lines.push(`> ${escapeMarkdown(ann.text ?? '')}`)
        break
      }

      case 'GLOBAL_COMMENT': {
        lines.push(`## ${num}. General feedback`)
        lines.push(`> ${escapeMarkdown(ann.text ?? '')}`)
        break
      }

      case 'INSERTION': {
        lines.push(`## ${num}. Add after this`)
        lines.push('```')
        lines.push(escapeCodeBlock(ann.originalText))
        lines.push('```')
        lines.push(`> ${escapeMarkdown(ann.text ?? '')}`)
        break
      }
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
