import Ionicons from '@expo/vector-icons/Ionicons'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { openBrowserAsync } from 'expo-web-browser'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Markdown from '@ronradtke/react-native-markdown-display'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useRoomWebSocket } from '@/hooks/use-room-websocket'
import { useTheme } from '@/hooks/use-theme'
import { loadLogs, loadMessages, sendMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

// --- Types for grouped rendering ---

type RenderItem =
  | { kind: 'message'; msg: Message; key: string }
  | { kind: 'log-group'; logs: Message[]; key: string }

// --- Grouping logic (chronological: consecutive logs fold together) ---

function groupMessages(messages: Message[]): RenderItem[] {
  // First pass: collect child logs by parent message_id
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

  // Second pass: build render items
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
      items.push({ kind: 'message', msg, key: msg.id })
    } else {
      flushLogs()
      items.push({ kind: 'message', msg, key: msg.id })
      // Attach child logs after their parent
      const children = childLogs.get(msg.id)
      if (children && children.length > 0) {
        items.push({ kind: 'log-group', logs: children, key: `lg-${children[0].id}` })
      }
    }
  }
  flushLogs()

  return items
}

// --- LogGroup component ---

function logSummaryText(logs: Message[]): string {
  const senders = [...new Set(logs.map((l) => l.sender))]
  const count = logs.length
  if (senders.length === 1) {
    return `${count} log ${count === 1 ? 'entry' : 'entries'} from ${senders[0]}`
  }
  return `${count} log entries from ${senders.length} agents`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

function LogGroup({ logs, theme }: { logs: Message[]; theme: ReturnType<typeof useTheme> }) {
  const [expanded, setExpanded] = useState(false)

  if (logs.length === 0) return null

  const firstTime = formatTime(logs[0].created_at)
  const lastTime = logs.length > 1 ? formatTime(logs[logs.length - 1].created_at) : null
  const timeRange = lastTime && lastTime !== firstTime ? `${firstTime} - ${lastTime}` : firstTime

  return (
    <View style={logStyles.container}>
      <Pressable
        style={[logStyles.header, { backgroundColor: theme.backgroundElement }]}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[logStyles.toggle, { color: theme.textSecondary }]}>
          {expanded ? '\u25BE' : '\u25B8'}
        </Text>
        <Text style={[logStyles.summary, { color: theme.textSecondary }]} numberOfLines={1}>
          {logSummaryText(logs)}
        </Text>
        <Text style={[logStyles.time, { color: theme.textSecondary }]}>
          {timeRange}
        </Text>
      </Pressable>
      {expanded && (
        <View style={logStyles.entries}>
          {logs.map((log) => {
            const senderColor = log.color || hashColor(log.sender)
            return (
              <View style={logStyles.entry} key={log.id}>
                <Text style={[logStyles.entryTime, { color: theme.textSecondary }]}>
                  {formatTime(log.created_at)}
                </Text>
                <Text style={[logStyles.entrySender, { color: senderColor }]}>
                  {log.sender}:
                </Text>
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

const logStyles = StyleSheet.create({
  container: {
    marginLeft: 42, // align with message content (avatar 32 + gap 10)
    borderRadius: 4,
    marginVertical: 1,
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

// --- Markdown styles ---

function useMarkdownStyles(theme: ReturnType<typeof useTheme>) {
  return useMemo(
    () => ({
      body: { color: theme.text, fontSize: 15, lineHeight: 21 },
      heading1: { color: theme.text, fontSize: 24, fontWeight: 'bold' as const, marginVertical: 4 },
      heading2: { color: theme.text, fontSize: 20, fontWeight: 'bold' as const, marginVertical: 4 },
      heading3: { color: theme.text, fontSize: 17, fontWeight: '600' as const, marginVertical: 2 },
      strong: { fontWeight: 'bold' as const },
      em: { fontStyle: 'italic' as const },
      link: { color: '#3b82f6', textDecorationLine: 'underline' as const },
      blockquote: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.textSecondary,
        borderLeftWidth: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginVertical: 4,
      },
      code_inline: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        fontFamily: monoFont,
        fontSize: 13,
      },
      code_block: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontFamily: monoFont,
        fontSize: 13,
      },
      fence: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontFamily: monoFont,
        fontSize: 13,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 4,
        flexWrap: 'wrap' as const,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
        width: '100%' as const,
      },
      bullet_list_icon: { color: theme.text, marginLeft: 4, marginRight: 8 },
      ordered_list_icon: { color: theme.text, marginLeft: 4, marginRight: 8 },
      hr: { backgroundColor: theme.textSecondary, height: 1, marginVertical: 8 },
      table: { borderWidth: 1, borderColor: theme.backgroundSelected, borderRadius: 4 },
      tr: { borderBottomWidth: 1, borderColor: theme.backgroundSelected, flexDirection: 'row' as const },
      td: { flex: 1, padding: 4 },
      th: { flex: 1, padding: 4, fontWeight: 'bold' as const },
    }),
    [theme],
  )
}

// --- Chat screen ---

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>()
  const { apiKey } = useAuth()
  const router = useRouter()
  const navigation = useNavigation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const markdownStyles = useMarkdownStyles(theme)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  const { connected, teamInfo } = useRoomWebSocket(id ?? null, apiKey, handleNewMessage)

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
          }}
        >
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
        (a, b) => new Date(a.created_at).valueOf() - new Date(b.created_at).valueOf(),
      )
      setMessages(all)
    })
  }, [id])

  const groupedItems = useMemo(() => groupMessages(messages).reverse(), [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || !id) return

    setSending(true)
    setInput('')
    try {
      await sendMessage(id, 'Mobile User', text)
    } catch {
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  function renderItem({ item }: { item: RenderItem }) {
    if (item.kind === 'log-group') {
      return <LogGroup logs={item.logs} theme={theme} />
    }

    const msg = item.msg
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {!connected && (
        <View style={styles.reconnectBar}>
          <Text style={styles.reconnectText}>Reconnecting...</Text>
        </View>
      )}

      <FlatList
        inverted
        style={styles.flatList}
        data={groupedItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom || 8, backgroundColor: theme.backgroundElement }]}>
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
          editable={!sending}
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  reconnectBar: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    alignItems: 'center',
  },
  reconnectText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messageList: { paddingVertical: 16, paddingHorizontal: 16, gap: 12 },
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
  inputBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
