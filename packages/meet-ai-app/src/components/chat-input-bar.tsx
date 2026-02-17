import Ionicons from '@expo/vector-icons/Ionicons'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputContentSizeChangeEvent,
  View,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
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

  const sendScale = useSharedValue(1)
  const sendOpacity = useSharedValue(0.35)
  const wasActive = useRef(false)

  useEffect(() => {
    const isActive = input.trim().length > 0
    if (isActive && !wasActive.current) {
      // Bounce: scale up then back to 1
      sendScale.value = withSpring(1.15, { damping: 8, stiffness: 300 }, () => {
        sendScale.value = withSpring(1, { damping: 12, stiffness: 180 })
      })
    } else if (!isActive && wasActive.current) {
      sendScale.value = withSpring(1, { damping: 12, stiffness: 180 })
    }
    sendOpacity.value = withSpring(isActive ? 1 : 0.35, { damping: 15, stiffness: 120 })
    wasActive.current = isActive
  }, [input, sendScale, sendOpacity])

  const sendButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendOpacity.value,
  }))

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
        accessibilityLabel="Type a message"
        accessibilityHint="Double tap to start typing"
      />
      <Animated.View style={sendButtonAnimStyle}>
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            pressed && Platform.OS === 'ios' && { opacity: 0.7 },
          ]}
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true }}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </Animated.View>
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
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
