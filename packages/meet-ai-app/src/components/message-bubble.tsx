import * as Haptics from 'expo-haptics'
import { openBrowserAsync } from 'expo-web-browser'
import React, { useCallback, useMemo } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Markdown from '@ronradtke/react-native-markdown-display'

import { useTheme } from '@/hooks/use-theme'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).valueOf()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

type Props = {
  msg: Message
  markdownStyles: ReturnType<typeof import('@/constants/markdown-styles').useMarkdownStyles>
  theme: ReturnType<typeof useTheme>
  onRetry?: (localId: string) => void
}

function MessageBubbleInner({ msg, markdownStyles, theme, onRetry }: Props) {
  const isAgent = msg.sender_type === 'agent'
  const isHuman = msg.sender_type === 'human'
  const senderColor = msg.color || hashColor(msg.sender)

  const handleLongPress = useCallback(() => {
    Haptics.selectionAsync()
  }, [])

  const accessibilityLabel = useMemo(() => {
    const truncated = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content
    return `${msg.sender} said: ${truncated}, ${timeAgo(msg.created_at)}`
  }, [msg.sender, msg.content, msg.created_at])

  return (
    <View
      style={[styles.messageRow, msg.status === 'failed' && styles.failedRow]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Pressable
        style={({ pressed }) => [
          styles.longPressArea,
          pressed && Platform.OS === 'ios' && { opacity: 0.7 },
        ]}
        onLongPress={handleLongPress}
        android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: false }}
      >
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
            {isHuman && msg.status && (
              <MessageStatusIndicator status={msg.status} localId={msg.localId} onRetry={onRetry} />
            )}
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
      </Pressable>
    </View>
  )
}

type StatusProps = {
  status: 'sending' | 'sent' | 'failed'
  localId?: string
  onRetry?: (localId: string) => void
}

function MessageStatusIndicator({ status, localId, onRetry }: StatusProps) {
  if (status === 'sending') {
    return <ActivityIndicator size={10} color="#9ca3af" style={styles.statusIndicator} />
  }
  if (status === 'sent') {
    return <Text style={[styles.statusIndicator, styles.sentIcon]}>{'✓'}</Text>
  }
  // failed
  return (
    <Pressable
      onPress={() => localId && onRetry?.(localId)}
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      style={styles.retryButton}
      accessibilityRole="button"
      accessibilityLabel="Retry sending message"
    >
      <Text style={styles.failedIcon}>{'✕'}</Text>
      <Text style={styles.retryText}>Retry</Text>
    </Pressable>
  )
}

export const MessageBubble = React.memo(MessageBubbleInner)

const styles = StyleSheet.create({
  messageRow: {},
  longPressArea: {
    flexDirection: 'row',
    gap: 10,
  },
  failedRow: {
    opacity: 0.7,
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
  statusIndicator: { marginLeft: 2 },
  sentIcon: { color: '#22c55e', fontSize: 12 },
  failedIcon: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
  },
  retryText: { color: '#ef4444', fontSize: 10, fontWeight: '600' },
})
