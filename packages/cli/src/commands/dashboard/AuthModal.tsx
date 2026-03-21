import { useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import Link from 'ink-link'
import { Spinner, TextInput } from '@inkjs/ui'
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
  const [keyInput, setKeyInput] = useState('')
  const [envName, setEnvName] = useState(defaultEnvName)
  const [envNameVersion, setEnvNameVersion] = useState(0)
  const [focus, setFocus] = useState<Field>('key')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const envNameTouched = useRef(false)

  useInput((_input, key) => {
    if (submitting) return

    if (key.escape) {
      onCancel()
      return
    }

    if (key.tab) {
      setFocus(f => {
        const idx = FIELDS.indexOf(f)
        return FIELDS[(idx + 1) % FIELDS.length]!
      })
      return
    }

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
        setError('URL must be a valid URL (e.g. https://meet-ai.cc/)')
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
    }
  })

  const linkUrl = (() => { try { return url && new URL(url).href } catch { return 'https://meet-ai.cc' } })() || 'https://meet-ai.cc'

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
        <TextInput
          defaultValue={DEFAULT_URL}
          onChange={val => {
            setUrl(val)
            if (!envNameTouched.current) {
              const derived = deriveEnvName(val)
              setEnvName(derived)
              setEnvNameVersion(v => v + 1)
            }
          }}
          isDisabled={focus !== 'url'}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'key' ? 'cyan' : undefined}>Key / Auth Link: </Text>
        <TextInput
          placeholder="mai_..."
          onChange={setKeyInput}
          isDisabled={focus !== 'key'}
        />
      </Box>

      <Box>
        <Text dimColor>Get your key at </Text>
        <Link url={linkUrl}>{linkUrl}</Link>
      </Box>

      <Box marginTop={1}>
        <Text color={focus === 'envName' ? 'cyan' : undefined}>Env Name: </Text>
        <TextInput
          key={envNameVersion}
          defaultValue={envName}
          onChange={val => {
            setEnvName(val)
            envNameTouched.current = true
          }}
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
        <Text dimColor>Tab to switch fields, Enter to submit, Esc to cancel.</Text>
      </Box>
    </Box>
  )
}
