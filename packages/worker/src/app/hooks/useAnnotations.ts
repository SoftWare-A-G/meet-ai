import { useState, useCallback, useEffect } from 'react'
import {
  type Annotation,
  type AnnotationType,
  createAnnotation,
  sortByPosition,
  getAnnotationsByBlock,
} from '../components/PlanReviewCard/annotations'

type PendingRemoval = {
  annotation: Annotation
  timer: ReturnType<typeof setTimeout>
}

export function useAnnotations(storageKey?: string, contentHash?: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    if (!storageKey) return []
    try {
      const stored = sessionStorage.getItem(`annotations:${storageKey}`)
      if (!stored) return []
      const data = JSON.parse(stored)
      // Skip restore if content changed
      if (contentHash && data.contentHash !== contentHash) return []
      return data.annotations ?? []
    } catch {
      return []
    }
  })
  const [pendingRemovals, setPendingRemovals] = useState<Map<string, PendingRemoval>>(new Map())

  // Clean up all timers on unmount
  useEffect(() => () => {
    setPendingRemovals(prev => {
      for (const { timer } of prev.values()) {
        clearTimeout(timer)
      }
      return prev
    })
  }, [])

  // Save annotations to sessionStorage on every change
  useEffect(() => {
    if (!storageKey) return
    try {
      sessionStorage.setItem(`annotations:${storageKey}`, JSON.stringify({
        annotations,
        contentHash,
      }))
    } catch {
      // sessionStorage full or unavailable — silently ignore
    }
  }, [annotations, storageKey, contentHash])

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
    setAnnotations(prev => {
      const ann = prev.find(a => a.id === id)
      if (!ann) return prev

      const timer = setTimeout(() => {
        setPendingRemovals(p => {
          const next = new Map(p)
          next.delete(id)
          return next
        })
      }, 5000)

      setPendingRemovals(p => new Map([...p, [id, { annotation: ann, timer }]]))

      return prev.filter(a => a.id !== id)
    })
  }, [])

  const undoRemoval = useCallback((id: string) => {
    setPendingRemovals(prev => {
      const pending = prev.get(id)
      if (!pending) return prev

      clearTimeout(pending.timer)

      setAnnotations(a => sortByPosition([...a, pending.annotation]))

      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const clearAnnotations = useCallback(() => {
    setPendingRemovals(prev => {
      for (const { timer } of prev.values()) {
        clearTimeout(timer)
      }
      return new Map()
    })
    setAnnotations([])
  }, [])

  const getByBlock = useCallback(
    (blockId: string) => getAnnotationsByBlock(annotations, blockId),
    [annotations],
  )

  return {
    annotations,
    pendingRemovals,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    undoRemoval,
    clearAnnotations,
    getByBlock,
  }
}
