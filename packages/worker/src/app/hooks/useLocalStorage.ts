import { useState, useCallback } from 'react'

export function useLocalStorage(key: string, initialValue: string): [string, (value: string) => void] {
  const [stored, setStored] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return initialValue
    return localStorage.getItem(key) ?? initialValue
  })

  const setValue = useCallback((value: string) => {
    setStored(value)
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  }, [key])

  return [stored, setValue]
}
