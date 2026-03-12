import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { listEnvs, setDefaultEnv, readHomeConfig, getDefaultEnv } from '@meet-ai/cli/lib/meetai-home'
import type { MeetAiConfig } from '@meet-ai/cli/config'

interface EnvSelectorModalProps {
  onSuccess: (config: MeetAiConfig) => void
  onCancel: () => void
}

export function EnvSelectorModal({ onSuccess, onCancel }: EnvSelectorModalProps) {
  const envs = listEnvs()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useInput((_input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }

    if (key.downArrow) {
      setSelectedIndex(i => Math.min(envs.length - 1, i + 1))
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
        onSuccess({ url: env.url, key: env.key })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  })

  if (envs.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">No environments found</Text>
        <Text dimColor>Run the sign-in flow first to add an environment.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">
        Select Default Environment
      </Text>
      <Text dimColor>Your default environment is missing or invalid. Pick one:</Text>

      <Box marginTop={1} flexDirection="column">
        {envs.map((env, index) => (
          <Text key={env.name} color={index === selectedIndex ? 'yellow' : undefined}>
            {index === selectedIndex ? '> ' : '  '}
            {env.name}
          </Text>
        ))}
      </Box>

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>Arrows to navigate, Enter to select, Esc to cancel.</Text>
      </Box>
    </Box>
  )
}
