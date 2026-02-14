import { render, useState, useCallback, useEffect } from 'hono/jsx/dom'
import LoginPrompt from './components/LoginPrompt'
import TokenScreen from './components/TokenScreen'
import ChatLayout from './components/ChatLayout'
import { useLocalStorage } from './hooks/useLocalStorage'
import { STORAGE_KEYS, DEFAULT_SCHEMA } from './lib/constants'
import { getOrCreateHandle } from './lib/handle'
import { applySchema } from './lib/theme'
import * as api from './lib/api'

function ChatApp() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => api.getApiKey())
  const [userName, setUserName] = useLocalStorage(STORAGE_KEYS.handle, getOrCreateHandle())
  const [colorSchema, setColorSchema] = useLocalStorage(STORAGE_KEYS.colorSchema, DEFAULT_SCHEMA)

  // Check for ?token= in URL
  const urlToken = new URLSearchParams(location.search).get('token')

  // Apply color schema on mount and changes
  useEffect(() => {
    applySchema(colorSchema)
  }, [colorSchema])

  const handleLogin = useCallback((key: string) => {
    api.setApiKey(key)
    setApiKeyState(key)
    history.replaceState(null, '', '/chat')
    location.reload()
  }, [])

  const handleSchemaChange = useCallback((schema: string) => {
    setColorSchema(schema)
    applySchema(schema)
  }, [])

  // If we have a token URL but already have a key, clean URL and proceed normally
  if (urlToken && apiKey) {
    history.replaceState(null, '', location.pathname)
  }

  // Token screen: have token but no key
  if (urlToken && !apiKey) {
    return <TokenScreen token={urlToken} onLogin={handleLogin} />
  }

  // Login prompt: no key
  if (!apiKey) {
    return <LoginPrompt onLogin={handleLogin} />
  }

  // Main chat
  return (
    <ChatLayout
      apiKey={apiKey}
      userName={userName}
      colorSchema={colorSchema}
      onNameChange={setUserName}
      onSchemaChange={handleSchemaChange}
    />
  )
}

const root = document.getElementById('root')
if (root) {
  render(<ChatApp />, root)
}
