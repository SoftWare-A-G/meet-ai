import { useState, useCallback } from 'hono/jsx/dom'

export function useLocalStorage(key: string, initialValue: string): [string, (value: string) => void] {
  const [stored, setStored] = useState<string>(() => {
    return localStorage.getItem(key) ?? initialValue
  })

  const setValue = useCallback((value: string) => {
    setStored(value)
    localStorage.setItem(key, value)
  }, [key])

  return [stored, setValue]
}
