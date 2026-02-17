import React, { useState } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/hooks/use-theme'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function logSummaryText(logs: Message[]): string {
  const senders = [...new Set(logs.map(l => l.sender))]
  const count = logs.length
  if (senders.length === 1) {
    return `${count} log ${count === 1 ? 'entry' : 'entries'} from ${senders[0]}`
  }
  return `${count} log entries from ${senders.length} agents`
}

type Props = {
  logs: Message[]
  theme: ReturnType<typeof useTheme>
}

function LogGroupInner({ logs, theme }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (logs.length === 0) return null

  const firstTime = formatTime(logs[0].created_at)
  const lastTime = logs.length > 1 ? formatTime(logs[logs.length - 1].created_at) : null
  const timeRange = lastTime && lastTime !== firstTime ? `${firstTime} - ${lastTime}` : firstTime

  return (
    <View style={logStyles.container}>
      <Pressable
        style={[logStyles.header, { backgroundColor: theme.backgroundElement }]}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setExpanded(!expanded)
        }}>
        <Text style={[logStyles.toggle, { color: theme.textSecondary }]}>
          {expanded ? '\u25BE' : '\u25B8'}
        </Text>
        <Text style={[logStyles.summary, { color: theme.textSecondary }]} numberOfLines={1}>
          {logSummaryText(logs)}
        </Text>
        <Text style={[logStyles.time, { color: theme.textSecondary }]}>{timeRange}</Text>
      </Pressable>
      {expanded && (
        <View style={logStyles.entries}>
          {logs.map(log => {
            const senderColor = log.color || hashColor(log.sender)
            return (
              <View style={logStyles.entry} key={log.id}>
                <Text style={[logStyles.entryTime, { color: theme.textSecondary }]}>
                  {formatTime(log.created_at)}
                </Text>
                <Text style={[logStyles.entrySender, { color: senderColor }]}>{log.sender}:</Text>
                <Text style={[logStyles.entryContent, { color: theme.text }]} numberOfLines={3}>
                  {log.content}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

export const LogGroup = React.memo(LogGroupInner)

const logStyles = StyleSheet.create({
  container: {
    marginLeft: 42,
    borderRadius: 4,
    marginTop: 0,
    marginBottom: 8,
    opacity: 0.65,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  toggle: {
    fontFamily: monoFont,
    fontSize: 10,
    width: 12,
    textAlign: 'center',
  },
  summary: {
    fontFamily: monoFont,
    fontSize: 12,
    flex: 1,
  },
  time: {
    fontFamily: monoFont,
    fontSize: 11,
    opacity: 0.5,
  },
  entries: {
    paddingTop: 0,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 20,
  },
  entry: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    paddingVertical: 1,
  },
  entryTime: {
    fontFamily: monoFont,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.45,
  },
  entrySender: {
    fontFamily: monoFont,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  entryContent: {
    fontFamily: monoFont,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
})
