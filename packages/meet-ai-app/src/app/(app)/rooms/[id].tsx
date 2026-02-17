import Ionicons from '@expo/vector-icons/Ionicons'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChatInputBar } from '@/components/chat-input-bar'
import { ConnectionStatus } from '@/components/connection-status'
import { LogGroup } from '@/components/log-group'
import { MessageBubble } from '@/components/message-bubble'
import { useMarkdownStyles } from '@/constants/markdown-styles'
import { useRoomWebSocket } from '@/hooks/use-room-websocket'
import { useTheme } from '@/hooks/use-theme'
import { loadLogs, loadMessages } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Message } from '@/lib/types'

// --- Types for grouped rendering ---

type RenderItem =
  | { kind: 'message'; msg: Message; key: string }
  | { kind: 'log-group'; logs: Message[]; key: string }

// --- Grouping logic (chronological: consecutive logs fold together) ---

function groupMessages(messages: Message[]): RenderItem[] {
  const childLogs = new Map<string, Message[]>()
  const standaloneItems: Message[] = []

  for (const msg of messages) {
    if (msg.type === 'log' && msg.message_id) {
      const arr = childLogs.get(msg.message_id) || []
      arr.push(msg)
      childLogs.set(msg.message_id, arr)
    } else {
      standaloneItems.push(msg)
    }
  }

  const items: RenderItem[] = []
  let logBuffer: Message[] = []

  function flushLogs() {
    if (logBuffer.length > 0) {
      items.push({ kind: 'log-group', logs: logBuffer, key: `lg-${logBuffer[0].id}` })
      logBuffer = []
    }
  }

  for (const msg of standaloneItems) {
    if (msg.type === 'log') {
      logBuffer.push(msg)
    } else if (msg.sender_type === 'human') {
      flushLogs()
      items.push({ kind: 'message', msg, key: msg.localId || msg.id })
    } else {
      flushLogs()
      items.push({ kind: 'message', msg, key: msg.id })
      const children = childLogs.get(msg.id)
      if (children && children.length > 0) {
        items.push({ kind: 'log-group', logs: children, key: `lg-${children[0].id}` })
      }
    }
  }
  flushLogs()

  return items
}

// --- Constants ---

const PAGE_SIZE = 50
const AUTO_SCROLL_THRESHOLD = 150

// --- Chat screen ---

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>()
  const { apiKey } = useAuth()
  const router = useRouter()
  const navigation = useNavigation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const markdownStyles = useMarkdownStyles(theme)

  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const listRef = useRef<FlashListRef<RenderItem>>(null)
  const isNearBottomRef = useRef(true)

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [])

  useKeyboardHandler(
    {
      onEnd: e => {
        'worklet'
        if (e.height > 0) {
          runOnJS(scrollToBottom)()
        }
      },
    },
    []
  )

  const handleNewMessage = useCallback((msg: Message) => {
    setAllMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  const { connectionStatus, teamInfo, messages: wsMessages, sendOptimistic, retryMessage } =
    useRoomWebSocket(id ?? null, apiKey, handleNewMessage)

  const { height: keyboardHeight, progress } = useReanimatedKeyboardAnimation()

  const listContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.abs(keyboardHeight.value),
  }))

  const inputBarTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardHeight.value }],
  }))

  const inputBarPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(progress.value, [0, 1], [insets.bottom, 0]),
  }))

  useLayoutEffect(() => {
    navigation.setOptions({
      title: name || 'Chat',
      headerRight: () => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/agents',
              params: { teamInfoJson: teamInfo ? JSON.stringify(teamInfo) : '' },
            })
          }
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="people-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      ),
    })
  }, [navigation, name, router, theme.textSecondary, teamInfo])

  useEffect(() => {
    if (!id) return
    const fetchMessages = loadMessages(id)
    const fetchLogs = loadLogs(id).catch(() => [] as Message[])
    Promise.all([fetchMessages, fetchLogs]).then(([msgs, logs]) => {
      const all = [...msgs, ...logs].sort(
        (a, b) => new Date(a.created_at).valueOf() - new Date(b.created_at).valueOf()
      )
      setAllMessages(all)
      setInitialLoading(false)
    })
  }, [id])

  // Merge server messages with optimistic messages from ws hook
  const mergedMessages = useMemo(() => {
    // Start with all loaded messages
    const merged = [...allMessages]
    // Add any optimistic messages from wsMessages that aren't in allMessages
    for (const wsMsg of wsMessages) {
      if (wsMsg.localId) {
        // This is an optimistic or locally-tracked message
        const existsInAll = merged.some(m => m.id === wsMsg.id || (m.localId && m.localId === wsMsg.localId))
        if (!existsInAll) {
          merged.push(wsMsg)
        } else {
          // Update existing with latest status from ws
          const idx = merged.findIndex(m => m.localId === wsMsg.localId)
          if (idx !== -1) {
            merged[idx] = wsMsg
          }
        }
      }
    }
    return merged.sort(
      (a, b) => new Date(a.created_at).valueOf() - new Date(b.created_at).valueOf()
    )
  }, [allMessages, wsMessages])

  // Auto-scroll to bottom when new messages arrive and user is near bottom
  const prevMessageCountRef = useRef(0)
  useEffect(() => {
    if (mergedMessages.length > prevMessageCountRef.current && isNearBottomRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
    prevMessageCountRef.current = mergedMessages.length
  }, [mergedMessages.length])

  // Slice messages for client-side pagination: show only the last `visibleCount`
  const visibleMessages = useMemo(() => {
    const startIdx = Math.max(0, mergedMessages.length - visibleCount)
    return mergedMessages.slice(startIdx)
  }, [mergedMessages, visibleCount])

  const hasOlderMessages = visibleCount < mergedMessages.length

  // Data is in chronological order (oldest first, newest last) — no inverted prop
  const groupedItems = useMemo(() => groupMessages(visibleMessages), [visibleMessages])

  const handleLoadOlder = useCallback(() => {
    if (!hasOlderMessages || loadingOlder) return
    setLoadingOlder(true)
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, mergedMessages.length))
      setLoadingOlder(false)
    }, 300)
  }, [hasOlderMessages, loadingOlder, mergedMessages.length])

  const handleSend = useCallback(
    async (text: string) => {
      if (!id) return
      await sendOptimistic('Mobile User', text)
    },
    [id, sendOptimistic]
  )

  const handleRetry = useCallback(
    (localId: string) => {
      retryMessage(localId)
    },
    [retryMessage]
  )

  const renderItem = useCallback(
    ({ item }: { item: RenderItem }) => {
      if (item.kind === 'log-group') {
        return <LogGroup logs={item.logs} theme={theme} />
      }
      return (
        <MessageBubble
          msg={item.msg}
          markdownStyles={markdownStyles}
          theme={theme}
          onRetry={handleRetry}
        />
      )
    },
    [theme, markdownStyles, handleRetry]
  )

  const keyExtractor = useCallback((item: RenderItem) => item.key, [])

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number }
        contentSize: { height: number }
        layoutMeasurement: { height: number }
      }
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height
      isNearBottomRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD
    },
    []
  )

  const ListHeader = useMemo(() => {
    if (loadingOlder) {
      return (
        <View style={styles.loadingOlder}>
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <Text style={[styles.loadingOlderText, { color: theme.textSecondary }]}>
            Loading older messages...
          </Text>
        </View>
      )
    }
    if (hasOlderMessages) {
      return (
        <Pressable style={styles.loadOlderButton} onPress={handleLoadOlder}>
          <Text style={[styles.loadOlderText, { color: '#3b82f6' }]}>Load older messages</Text>
        </Pressable>
      )
    }
    return null
  }, [loadingOlder, hasOlderMessages, handleLoadOlder, theme.textSecondary])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ConnectionStatus status={connectionStatus} />

      <Animated.View style={[styles.listWrapper, listContainerStyle]}>
        {initialLoading ? (
          <View style={styles.initialLoading}>
            <ActivityIndicator size="large" color={theme.textSecondary} />
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={groupedItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            ListHeaderComponent={ListHeader}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{
              startRenderingFromBottom: true,
            }}
            keyboardDismissMode="interactive"
          />
        )}
      </Animated.View>

      <Animated.View style={inputBarTranslateStyle}>
        <Animated.View style={inputBarPaddingStyle}>
          <ChatInputBar roomId={id ?? ''} onSend={handleSend} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listWrapper: { flex: 1 },
  initialLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: { paddingVertical: 16, paddingHorizontal: 16 },
  loadingOlder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingOlderText: {
    fontSize: 13,
  },
  loadOlderButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadOlderText: {
    fontSize: 13,
    fontWeight: '600',
  },
})
