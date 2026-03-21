import { Box, Text, useInput } from 'ink'
import { Select } from '@inkjs/ui'
import { addEnv } from '@meet-ai/cli/lib/meetai-home'
import type { MeetAiConfig, MigratableConfigSource } from '@meet-ai/cli/config'

interface MigrationModalProps {
  sources: MigratableConfigSource[]
  onSuccess: (config: MeetAiConfig) => void
  onCancel: () => void
  onManualSignIn: () => void
}

const MANUAL_SIGN_IN_VALUE = '__manual_sign_in__'

export function MigrationModal({
  sources,
  onSuccess,
  onCancel,
  onManualSignIn,
}: MigrationModalProps) {
  useInput((_input, key) => {
    if (key.escape) {
      onCancel()
    }
  })

  const options = [
    ...sources.map(source => ({
      label: `${source.label}: ${source.url} -> ${source.envName}`,
      value: `${source.kind}:${source.path}`,
    })),
    { label: 'Sign in manually', value: MANUAL_SIGN_IN_VALUE },
  ]

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">
        Meet AI - Import Existing Credentials
      </Text>
      <Text dimColor>
        No Meet AI home config was found. Import credentials from an existing tool config.
      </Text>

      <Box marginTop={1}>
        <Select
          options={options}
          onChange={value => {
            if (value === MANUAL_SIGN_IN_VALUE) {
              onManualSignIn()
              return
            }

            const source = sources.find(s => `${s.kind}:${s.path}` === value)
            if (!source) return
            addEnv(source.envName, { url: source.url, key: source.key })
            onSuccess({ url: source.url, key: source.key })
          }}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Arrows to navigate, Enter to choose, Esc to cancel.</Text>
      </Box>
    </Box>
  )
}
