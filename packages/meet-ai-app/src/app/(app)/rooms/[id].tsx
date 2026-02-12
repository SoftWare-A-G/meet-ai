import { useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useRoomWebSocket } from '@/hooks/use-room-websocket'
import { useTheme } from '@/hooks/use-theme'
import { loadMessages, sendMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>()
  const { apiKey } = useAuth()
  const navigation = useNavigation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || 'Chat' })
  }, [navigation, name])

  useEffect(() => {
    if (!id) return
    loadMessages(id).then(setMessages)
  }, [id])

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  const { connected } = useRoomWebSocket(id ?? null, apiKey, handleNewMessage)

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

  function renderMessage({ item }: { item: Message }) {
    const isAgent = item.sender_type === 'agent'
    const senderColor = item.color || hashColor(item.sender)

    return (
      <View style={styles.messageRow}>
        <View style={[styles.avatar, { backgroundColor: senderColor }]}>
          <Text style={styles.avatarText}>
            {item.sender.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.senderName, { color: senderColor }]}>
              {item.sender}
            </Text>
            {isAgent && (
              <View style={styles.agentBadge}>
                <Text style={styles.agentBadgeText}>agent</Text>
              </View>
            )}
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.messageText, { color: theme.text }]}>
            {item.content}
          </Text>
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
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
  reconnectBar: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    alignItems: 'center',
  },
  reconnectText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messageList: { padding: 16, gap: 12 },
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
  messageText: { fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    alignItems: 'flex-end',
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
