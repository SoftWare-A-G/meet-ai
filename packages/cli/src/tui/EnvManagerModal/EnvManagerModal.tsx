import {
  DEFAULT_URL,
  deriveEnvName,
  resolveKeyInput,
} from '@meet-ai/cli/commands/dashboard/auth-helpers'
import {
  listEnvs,
  setDefaultEnv,
  readHomeConfig,
  readHomeConfigLoose,
  getDefaultEnv,
  addEnv,
} from '@meet-ai/cli/lib/meetai-home'
import { Box, Text, useInput } from 'ink'
import { useRef, useState } from 'react'
import type { MeetAiConfig } from '@meet-ai/cli/config'

interface EnvManagerModalProps {
  onSwitch: (config: MeetAiConfig) => void
  onCancel: () => void
}

type View = 'switch' | 'add'
type Field = 'url' | 'key' | 'envName'
const FIELDS: Field[] = ['url', 'key', 'envName']

export default function EnvManagerModal({ onSwitch, onCancel }: EnvManagerModalProps) {
  const [view, setView] = useState<View>('switch')

  // --- Add view state ---
  const [url, setUrl] = useState(DEFAULT_URL)
  const [urlCursor, setUrlCursor] = useState(DEFAULT_URL.length)
  const [keyInput, setKeyInput] = useState('')
  const [keyCursor, setKeyCursor] = useState(0)
  const defaultEnvName = deriveEnvName(DEFAULT_URL)
  const [envName, setEnvName] = useState(defaultEnvName)
  const [envNameCursor, setEnvNameCursor] = useState(defaultEnvName.length)
  const [focus, setFocus] = useState<Field>('key')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const envNameTouched = useRef(false)

  // --- Switch view state ---
  const envs = listEnvs()
  const defaultIndex = envs.findIndex(e => e.isDefault)
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex !== -1 ? defaultIndex : 0)

  useInput((input, key) => {
    if (submitting) return

    if (key.escape) {
      if (view === 'add') {
        setView('switch')
        setError(null)
      } else {
        onCancel()
      }
      return
    }

    // Tab toggles view
    if (key.tab) {
      if (view === 'switch') {
        setView('add')
        setError(null)
      } else {
        setFocus(f => {
          const idx = FIELDS.indexOf(f)
          return FIELDS[(idx + 1) % FIELDS.length]!
        })
      }
      return
    }

    // --- Switch view ---
    if (view === 'switch') {
      if (key.upArrow) {
        setSelectedIndex(i => Math.max(0, i - 1))
        return
      }
      if (key.downArrow) {
        setSelectedIndex(i => Math.min(envs.length - 1, i + 1))
        return
      }
      if (input === 'a') {
        setView('add')
        setError(null)
        return
      }
      if (key.return && envs.length > 0) {
        const chosen = envs[selectedIndex]
        if (!chosen) return

        try {
          setDefaultEnv(chosen.name)
          const config = readHomeConfig()
          if (!config) {
            setError('Failed to read config after setting default')
            return
          }
          const env = getDefaultEnv(config)
          onSwitch({ url: env.url, key: env.key })
        } catch (error) {
          setError(error instanceof Error ? error.message : String(error))
        }
      }
      return
    }

    // --- Add view ---
    if (key.return) {
      setError(null)

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
        setError(`Environment "${trimmedName}" already exists`)
        return
      }

      setSubmitting(true)

      resolveKeyInput(url, keyInput)
        .then(resolvedKey => {
          addEnv(trimmedName, { url, key: resolvedKey })
          setDefaultEnv(trimmedName)
          onSwitch({ url, key: resolvedKey })
        })
        .catch((error: Error) => {
          setError(error.message)
          setSubmitting(false)
        })
      return
    }

    // Text editing for Add view
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
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Box gap={2}>
        <Text bold color="green">
          Environment Manager
        </Text>
        <Text dimColor>{view === 'switch' ? '[Switch] | Add' : 'Switch | [Add]'}</Text>
      </Box>

      {view === 'switch' ? (
        <SwitchView envs={envs} selectedIndex={selectedIndex} error={error} />
      ) : (
        <AddView
          url={url}
          urlCursor={urlCursor}
          keyInput={keyInput}
          keyCursor={keyCursor}
          envName={envName}
          envNameCursor={envNameCursor}
          focus={focus}
          error={error}
          submitting={submitting}
        />
      )}
    </Box>
  )
}

function SwitchView({
  envs,
  selectedIndex,
  error,
}: {
  envs: { name: string; isDefault: boolean }[]
  selectedIndex: number
  error: string | null
}) {
  if (envs.length === 0) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>No environments found. Press [a] to add one.</Text>
      </Box>
    )
  }

  return (
    <Box marginTop={1} flexDirection="column">
      {envs.map((env, index) => (
        <Text key={env.name} color={index === selectedIndex ? 'green' : undefined}>
          {index === selectedIndex ? '> ' : '  '}
          {env.name}
          {env.isDefault ? ' (active)' : ''}
        </Text>
      ))}

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>Arrows navigate, Enter selects, [a] add new, Esc close.</Text>
      </Box>
    </Box>
  )
}

function AddView({
  url,
  urlCursor,
  keyInput,
  keyCursor,
  envName,
  envNameCursor,
  focus,
  error,
  submitting,
}: {
  url: string
  urlCursor: number
  keyInput: string
  keyCursor: number
  envName: string
  envNameCursor: number
  focus: Field
  error: string | null
  submitting: boolean
}) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color={focus === 'url' ? 'green' : undefined}>URL: </Text>
        <FieldDisplay value={url} cursor={urlCursor} active={focus === 'url'} />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'key' ? 'green' : undefined}>Key / Auth Link: </Text>
        <FieldDisplay value={keyInput} cursor={keyCursor} active={focus === 'key'} />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'envName' ? 'green' : undefined}>Env Name: </Text>
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
        <Text dimColor>[Tab] next field, [Enter] submit, [Esc] back.</Text>
      </Box>
    </Box>
  )
}

function FieldDisplay({
  value,
  cursor,
  active,
}: {
  value: string
  cursor: number
  active: boolean
}) {
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
