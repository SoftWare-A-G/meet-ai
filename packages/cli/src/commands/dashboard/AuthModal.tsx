import { useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { addEnv, readHomeConfigLoose } from '@meet-ai/cli/lib/meetai-home'
import { DEFAULT_URL, deriveEnvName, resolveKeyInput } from './auth-helpers'
import type { MeetAiConfig } from '@meet-ai/cli/config'

interface AuthModalProps {
  onSuccess: (config: MeetAiConfig) => void
  onCancel: () => void
}

type Field = 'url' | 'key' | 'envName'
const FIELDS: Field[] = ['url', 'key', 'envName']

export function AuthModal({ onSuccess, onCancel }: AuthModalProps) {
  const defaultEnvName = deriveEnvName(DEFAULT_URL)
  const [url, setUrl] = useState(DEFAULT_URL)
  const [urlCursor, setUrlCursor] = useState(DEFAULT_URL.length)
  const [keyInput, setKeyInput] = useState('')
  const [keyCursor, setKeyCursor] = useState(0)
  const [envName, setEnvName] = useState(defaultEnvName)
  const [envNameCursor, setEnvNameCursor] = useState(defaultEnvName.length)
  const [focus, setFocus] = useState<Field>('key')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const envNameTouched = useRef(false)

  useInput((input, key) => {
    if (submitting) return

    if (key.escape) {
      onCancel()
      return
    }

    if (key.tab) {
      setFocus(f => {
        const idx = FIELDS.indexOf(f)
        return FIELDS[(idx + 1) % FIELDS.length]
      })
      return
    }

    if (key.return) {
      setError(null)

      // Validate env name uniqueness
      const trimmedName = envName.trim()
      if (!trimmedName) {
        setError('Environment name is required')
        return
      }

      try {
        new URL(url)
      } catch {
        setError('URL must be a valid URL (e.g. https://meet-ai.cc)')
        return
      }

      const existingConfig = readHomeConfigLoose()
      if (existingConfig && trimmedName in existingConfig.envs) {
        setError(`Environment "${trimmedName}" already exists — choose a different name`)
        return
      }

      setSubmitting(true)

      resolveKeyInput(url, keyInput)
        .then(resolvedKey => {
          addEnv(trimmedName, { url, key: resolvedKey })
          onSuccess({ url, key: resolvedKey })
        })
        .catch((error: Error) => {
          setError(error.message)
          setSubmitting(false)
        })
      return
    }

    // Text editing
    const [value, setValue, cursor, setCursor] =
      focus === 'url'
        ? [url, setUrl, urlCursor, setUrlCursor]
        : focus === 'key'
          ? [keyInput, setKeyInput, keyCursor, setKeyCursor]
          : [envName, setEnvName, envNameCursor, setEnvNameCursor]

    if (key.leftArrow) {
      setCursor(Math.max(0, cursor - 1))
      return
    }
    if (key.rightArrow) {
      setCursor(Math.min(value.length, cursor + 1))
      return
    }
    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setValue(value.slice(0, cursor - 1) + value.slice(cursor))
        setCursor(cursor - 1)
        if (focus === 'envName') envNameTouched.current = true
      }
      return
    }
    if (input && !key.ctrl && !key.meta) {
      setValue(value.slice(0, cursor) + input + value.slice(cursor))
      setCursor(cursor + input.length)

      // Auto-derive env name when URL changes (unless user manually edited it)
      if (focus === 'url' && !envNameTouched.current) {
        const newUrl = url.slice(0, urlCursor) + input + url.slice(urlCursor)
        const derived = deriveEnvName(newUrl)
        setEnvName(derived)
        setEnvNameCursor(derived.length)
      }
      if (focus === 'envName') envNameTouched.current = true
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Text bold color="cyan">
        Meet AI — Sign In
      </Text>

      <Box marginTop={1}>
        <Text color={focus === 'url' ? 'cyan' : undefined}>URL: </Text>
        <FieldDisplay value={url} cursor={urlCursor} active={focus === 'url'} />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'key' ? 'cyan' : undefined}>Key / Auth Link: </Text>
        <FieldDisplay value={keyInput} cursor={keyCursor} active={focus === 'key'} />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'envName' ? 'cyan' : undefined}>Env Name: </Text>
        <FieldDisplay value={envName} cursor={envNameCursor} active={focus === 'envName'} />
      </Box>

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      {submitting ? (
        <Box marginTop={1}>
          <Text color="yellow">Authenticating...</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>Tab to switch fields, Enter to submit, Esc to cancel.</Text>
      </Box>
    </Box>
  )
}

function FieldDisplay({ value, cursor, active }: { value: string; cursor: number; active: boolean }) {
  const before = value.slice(0, cursor)
  const at = value[cursor] ?? ' '
  const after = value.slice(cursor + 1)

  return (
    <Text>
      <Text color="cyan">{before}</Text>
      <Text backgroundColor={active ? 'cyan' : undefined} color={active ? 'black' : 'cyan'}>
        {at}
      </Text>
      <Text color="cyan">{after}</Text>
    </Text>
  )
}
