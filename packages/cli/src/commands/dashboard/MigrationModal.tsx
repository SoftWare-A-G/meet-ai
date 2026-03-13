import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { addEnv } from '@meet-ai/cli/lib/meetai-home'
import type { MeetAiConfig, MigratableConfigSource } from '@meet-ai/cli/config'

interface MigrationModalProps {
  sources: MigratableConfigSource[]
  onSuccess: (config: MeetAiConfig) => void
  onCancel: () => void
  onManualSignIn: () => void
}

export function MigrationModal({
  sources,
  onSuccess,
  onCancel,
  onManualSignIn,
}: MigrationModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

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
      setSelectedIndex(i => Math.min(sources.length, i + 1))
      return
    }

    if (key.return) {
      if (selectedIndex === sources.length) {
        onManualSignIn()
        return
      }

      const chosen = sources[selectedIndex]
      if (!chosen) return
      addEnv(chosen.envName, { url: chosen.url, key: chosen.key })
      onSuccess({ url: chosen.url, key: chosen.key })
    }
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">
        Meet AI - Import Existing Credentials
      </Text>
      <Text dimColor>
        No Meet AI home config was found. Import credentials from an existing tool config.
      </Text>

      <Box marginTop={1} flexDirection="column">
        {sources.map((source, index) => (
          <Text key={`${source.kind}:${source.path}`} color={index === selectedIndex ? 'green' : undefined}>
            {index === selectedIndex ? '> ' : '  '}
            {source.label}: {source.url} {'->'} {source.envName}
          </Text>
        ))}
        <Text color={selectedIndex === sources.length ? 'green' : undefined}>
          {selectedIndex === sources.length ? '> ' : '  '}
          Sign in manually
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Arrows to navigate, Enter to choose, Esc to cancel.</Text>
      </Box>
    </Box>
  )
}
