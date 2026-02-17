import Ionicons from '@expo/vector-icons/Ionicons'
import React, { useCallback, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputContentSizeChangeEvent,
  View,
} from 'react-native'
import { useTheme } from '@/hooks/use-theme'

const MIN_INPUT_HEIGHT = 40
const MAX_INPUT_HEIGHT = 120

interface ChatInputBarProps {
  roomId: string
  onSend: (text: string) => Promise<void>
}

export function ChatInputBar({ roomId, onSend }: ChatInputBarProps) {
  const theme = useTheme()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT)

  const inputRef = useRef<TextInput>(null)

  const canSend = input.trim().length > 0 && !sending

  const handleContentSizeChange = useCallback((e: TextInputContentSizeChangeEvent) => {
    const contentHeight = e.nativeEvent.contentSize.height
    setInputHeight(Math.min(Math.max(contentHeight, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT))
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !roomId) return

    setSending(true)
    setInput('')
    setInputHeight(MIN_INPUT_HEIGHT)
    try {
      await onSend(text)
      inputRef.current?.focus()
    } catch {
      setInput(text)
    } finally {
      setSending(false)
    }
  }, [input, roomId, onSend])

  return (
    <View
      style={[
        styles.inputBar,
        { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected },
      ]}>
      <TextInput
        style={[
          styles.textInput,
          {
            color: theme.text,
            backgroundColor: theme.background,
            height: inputHeight,
          },
        ]}
        placeholder="Type a message..."
        placeholderTextColor={theme.textSecondary}
        ref={inputRef}
        value={input}
        onChangeText={setInput}
        onContentSizeChange={handleContentSizeChange}
        multiline
        editable={!sending}
      />
      <Pressable
        style={[styles.sendButton, { opacity: canSend ? 1 : 0.35 }]}
        onPress={handleSend}
        disabled={!canSend}>
        <Ionicons name="arrow-up" size={20} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'flex-end',
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: MAX_INPUT_HEIGHT,
  },
  sendButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
