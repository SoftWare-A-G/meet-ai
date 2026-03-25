import { Select, Spinner, TextInput } from '@inkjs/ui'
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
import Link from 'ink-link'
import { useRef, useState } from 'react'
import Divider from '../Divider'
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
  const [keyInput, setKeyInput] = useState('')
  const defaultEnvName = deriveEnvName(DEFAULT_URL)
  const [envName, setEnvName] = useState(defaultEnvName)
  const [envNameVersion, setEnvNameVersion] = useState(0)
  const [focus, setFocus] = useState<Field>('key')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const envNameTouched = useRef(false)

  // --- Switch view state ---
  const envs = listEnvs()

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
      if (input === 'a') {
        setView('add')
        setError(null)
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

      <Divider dividerColor="green" />

      {view === 'switch' ? (
        <SwitchView envs={envs} error={error} onSwitch={onSwitch} />
      ) : (
        <AddView
          url={url}
          setUrl={val => {
            setUrl(val)
            if (!envNameTouched.current) {
              const derived = deriveEnvName(val)
              setEnvName(derived)
              setEnvNameVersion(v => v + 1)
            }
          }}
          setKeyInput={setKeyInput}
          envName={envName}
          envNameVersion={envNameVersion}
          setEnvName={val => {
            setEnvName(val)
            envNameTouched.current = true
          }}
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
  error,
  onSwitch,
}: {
  envs: { name: string; isDefault: boolean }[]
  error: string | null
  onSwitch: (config: MeetAiConfig) => void
}) {
  const [switchError, setSwitchError] = useState<string | null>(null)
  const displayError = error ?? switchError

  if (envs.length === 0) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>No environments found. Press [a] to add one.</Text>
      </Box>
    )
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Select
        options={envs.map(env => ({
          label: env.name + (env.isDefault ? ' (active)' : ''),
          value: env.name,
        }))}
        onChange={name => {
          try {
            setDefaultEnv(name)
            const config = readHomeConfig()
            if (!config) {
              setSwitchError('Failed to read config after setting default')
              return
            }
            const env = getDefaultEnv(config)
            onSwitch({ url: env.url, key: env.key })
          } catch (error) {
            setSwitchError(error instanceof Error ? error.message : String(error))
          }
        }}
      />

      {displayError ? (
        <Box marginTop={1}>
          <Text color="red">{displayError}</Text>
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
  setUrl,
  setKeyInput,
  envName,
  envNameVersion,
  setEnvName,
  focus,
  error,
  submitting,
}: {
  url: string
  setUrl: (val: string) => void
  setKeyInput: (val: string) => void
  envName: string
  envNameVersion: number
  setEnvName: (val: string) => void
  focus: Field
  error: string | null
  submitting: boolean
}) {
  const linkUrl =
    (() => {
      try {
        return url && new URL(url).href
      } catch {
        return 'https://meet-ai.cc'
      }
    })() || 'https://meet-ai.cc'

  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color={focus === 'url' ? 'green' : undefined}>URL: </Text>
        <TextInput defaultValue={url} onChange={setUrl} isDisabled={focus !== 'url'} />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'key' ? 'green' : undefined}>Key / Auth Link: </Text>
        <TextInput placeholder="mai_..." onChange={setKeyInput} isDisabled={focus !== 'key'} />
      </Box>

      <Box>
        <Text dimColor>Get your key at </Text>
        <Link url={linkUrl} fallback={false}>{linkUrl}</Link>
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'envName' ? 'green' : undefined}>Env Name: </Text>
        <TextInput
          key={envNameVersion}
          defaultValue={envName}
          onChange={setEnvName}
          isDisabled={focus !== 'envName'}
        />
      </Box>

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      {submitting ? (
        <Box marginTop={1}>
          <Spinner label="Authenticating..." />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>[Tab] next field, [Enter] submit, [Esc] back.</Text>
      </Box>
    </Box>
  )
}
