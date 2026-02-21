import { useState, useCallback } from 'react'
import {
  type Annotation,
  type AnnotationType,
  createAnnotation,
  sortByPosition,
  getAnnotationsByBlock,
} from '../components/PlanReviewCard/annotations'

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const addAnnotation = useCallback(
    (params: {
      blockId: string
      startOffset: number
      endOffset: number
      type: AnnotationType
      originalText: string
      text?: string
      author?: string
    }): Annotation => {
      const annotation = createAnnotation(params)
      setAnnotations(prev => sortByPosition([...prev, annotation]))
      return annotation
    },
    [],
  )

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Pick<Annotation, 'text' | 'type'>>) => {
      setAnnotations(prev =>
        prev.map(a => (a.id === id ? { ...a, ...updates } : a)),
      )
    },
    [],
  )

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAnnotations = useCallback(() => {
    setAnnotations([])
  }, [])

  const getByBlock = useCallback(
    (blockId: string) => getAnnotationsByBlock(annotations, blockId),
    [annotations],
  )

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    clearAnnotations,
    getByBlock,
  }
}
