import { openBrowserAsync } from 'expo-web-browser'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Markdown from '@ronradtke/react-native-markdown-display'

import { useTheme } from '@/hooks/use-theme'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

type Props = {
  msg: Message
  markdownStyles: ReturnType<typeof import('@/constants/markdown-styles').useMarkdownStyles>
  theme: ReturnType<typeof useTheme>
}

function MessageBubbleInner({ msg, markdownStyles, theme }: Props) {
  const isAgent = msg.sender_type === 'agent'
  const senderColor = msg.color || hashColor(msg.sender)

  return (
    <View style={styles.messageRow}>
      <View style={[styles.avatar, { backgroundColor: senderColor }]}>
        <Text style={styles.avatarText}>
          {msg.sender.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={[styles.senderName, { color: senderColor }]}>
            {msg.sender}
          </Text>
          {isAgent && (
            <View style={styles.agentBadge}>
              <Text style={styles.agentBadgeText}>agent</Text>
            </View>
          )}
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Markdown
          style={markdownStyles}
          onLinkPress={(url) => {
            openBrowserAsync(url)
            return false
          }}
        >
          {msg.content}
        </Markdown>
      </View>
    </View>
  )
}

export const MessageBubble = React.memo(MessageBubbleInner)

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  messageContent: { flex: 1, gap: 2 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  senderName: { fontSize: 13, fontWeight: '600' },
  agentBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  agentBadgeText: { color: '#3b82f6', fontSize: 10, fontWeight: '600' },
  timestamp: { fontSize: 11 },
})
