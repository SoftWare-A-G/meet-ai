import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getStoredKey, setStoredKey, clearStoredKey, loadRooms } from './api'

type AuthState = {
  apiKey: string | null
  isLoading: boolean
  login: (key: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  apiKey: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getStoredKey().then((key) => {
      setApiKey(key)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (key: string) => {
    await setStoredKey(key)
    try {
      await loadRooms()
      setApiKey(key)
    } catch {
      await clearStoredKey()
      throw new Error('Invalid API key')
    }
  }, [])

  const logout = useCallback(async () => {
    await clearStoredKey()
    setApiKey(null)
  }, [])

  return (
    <AuthContext.Provider value={{ apiKey, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
