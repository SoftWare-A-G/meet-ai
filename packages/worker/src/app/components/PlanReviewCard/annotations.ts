export type AnnotationType = 'DELETION' | 'REPLACEMENT' | 'COMMENT'

export type Annotation = {
  id: string
  blockId: string
  startOffset: number
  endOffset: number
  type: AnnotationType
  text?: string
  originalText: string
  createdAt: number
  author?: string
}

let counter = 0

export function generateId(): string {
  counter += 1
  return `ann-${Date.now()}-${counter}`
}

export function sortByPosition(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId)
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset
    return a.endOffset - b.endOffset
  })
}

export function getAnnotationsByBlock(
  annotations: Annotation[],
  blockId: string,
): Annotation[] {
  return sortByPosition(annotations.filter(a => a.blockId === blockId))
}

export function createAnnotation(
  params: Omit<Annotation, 'id' | 'createdAt'>,
): Annotation {
  return {
    ...params,
    id: generateId(),
    createdAt: Date.now(),
  }
}

export const ANNOTATION_COLORS: Record<AnnotationType, { bg: string; border: string; text: string }> = {
  DELETION: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' },
  REPLACEMENT: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#ca8a04' },
  COMMENT: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#8b5cf6' },
}