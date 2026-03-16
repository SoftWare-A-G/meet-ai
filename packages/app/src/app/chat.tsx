import { FlashList } from '@shopify/flash-list'
import { useCallback, useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollViewProps,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSharedValue } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemedText } from '@/components/ThemedText'
import { Fonts, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string
  text: string
  sender: 'me' | 'other'
  timestamp: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_MESSAGES: Message[] = [
  {
    id: '13',
    text: 'Good luck! Let me know if you need any more help. Building chat apps is super fun once you get the keyboard handling right 🎉',
    sender: 'other',
    timestamp: '9:10 AM',
  },
  {
    id: '12',
    text: "Awesome, thanks for the tips! I'll start building my chat app now 💬",
    sender: 'me',
    timestamp: '9:09 AM',
  },
  {
    id: '11',
    text: 'Absolutely! FlashList works great with Reanimated. You can animate individual list items. Just keep in mind that item layout animations need accurate sizing for best performance.',
    sender: 'other',
    timestamp: '9:08 AM',
  },
  { id: '10', text: 'Can I use it with FlashList?', sender: 'me', timestamp: '9:07 AM' },
  {
    id: '9',
    text: 'Reanimated has built-in Layout Animations — FadeIn, SlideInRight, etc. Just add entering and exiting props to your Animated.View. Super easy!',
    sender: 'other',
    timestamp: '9:06 AM',
  },
  {
    id: '8',
    text: "Perfect, I'll check it out. What about layout animations?",
    sender: 'me',
    timestamp: '9:06 AM',
  },
  {
    id: '7',
    text: "There's a small learning curve with the worklet concept, but the docs are excellent. Start with useSharedValue and useAnimatedStyle — those two cover 80% of use cases.",
    sender: 'other',
    timestamp: '9:05 AM',
  },
  { id: '6', text: 'That sounds great. Is it hard to learn?', sender: 'me', timestamp: '9:04 AM' },
  {
    id: '5',
    text: 'react-native-reanimated is the go-to choice! It gives you smooth 60fps animations running on the UI thread. Combine it with react-native-gesture-handler for interactive gestures.',
    sender: 'other',
    timestamp: '9:03 AM',
  },
  {
    id: '4',
    text: "I'm looking for recommendations on a good React Native animation library.",
    sender: 'me',
    timestamp: '9:02 AM',
  },
  { id: '3', text: 'How can I help you today?', sender: 'other', timestamp: '9:01 AM' },
  { id: '2', text: 'Hi there! Thanks for having me.', sender: 'me', timestamp: '9:01 AM' },
  { id: '1', text: 'Hey! Welcome to Meet AI 👋', sender: 'other', timestamp: '9:00 AM' },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_BAR_HEIGHT = 52
const SINGLE_LINE_TEXT_HEIGHT = 22

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  const theme = useTheme()
  const isMe = message.sender === 'me'

  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      <View
        style={[
          styles.bubble,
          isMe
            ? [styles.bubbleMe, { backgroundColor: theme.tint }]
            : [styles.bubbleOther, { backgroundColor: theme.backgroundElement }],
        ]}>
        <ThemedText style={[styles.bubbleText, isMe && { color: theme.tintText }]}>
          {message.text}
        </ThemedText>
        <ThemedText
          style={[styles.timestamp, isMe ? { color: theme.tintTextSecondary } : { color: theme.textSecondary }]}>
          {message.timestamp}
        </ThemedText>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// ChatInput — iOS 26 Messages style
// ---------------------------------------------------------------------------

function ChatInput({
  value,
  onChangeText,
  onSend,
  onHeightChange,
}: {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onHeightChange: (growth: number) => void
}) {
  const theme = useTheme()
  const hasText = value.trim().length > 0

  const handleContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const textHeight = e.nativeEvent.contentSize.height
      const clampedHeight = Math.min(textHeight, 100)
      const growth = Math.max(0, clampedHeight - SINGLE_LINE_TEXT_HEIGHT)
      onHeightChange(growth)
    },
    [onHeightChange]
  )

  return (
    <View style={styles.inputWrapper}>
      {/* + button */}
      <Pressable
        style={({ pressed }) => [
          styles.plusButton,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
        ]}>
        <Text style={[styles.plusButtonText, { color: theme.textSecondary }]}>+</Text>
      </Pressable>

      {/* Text field — outlined capsule */}
      <View style={[styles.inputField, { borderColor: theme.backgroundSelected }]}>
        <TextInput
          multiline
          value={value}
          maxLength={1000}
          placeholder="Message"
          placeholderTextColor={theme.textSecondary}
          onChangeText={onChangeText}
          onContentSizeChange={handleContentSizeChange}
          style={[styles.input, { color: theme.text }]}
        />
      </View>

      {/* Send / Mic button */}
      {hasText ? (
        <Pressable
          onPress={onSend}
          style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.tint, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.sendButtonText, { color: theme.tintText }]}>↑</Text>
        </Pressable>
      ) : (
        <Pressable style={({ pressed }) => [styles.micButton, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.micButtonText, { color: theme.textSecondary }]}>🎙</Text>
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Chat screen
// ---------------------------------------------------------------------------

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)
  const [inputText, setInputText] = useState('')
  const composerHeight = useSharedValue(0)

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return

    const newMessage: Message = {
      id: String(Date.now()),
      text: trimmed,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }

    setMessages(prev => [newMessage, ...prev])
    setInputText('')
  }, [inputText])

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    []
  )

  const keyExtractor = useCallback((item: Message) => item.id, [])

  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        {...props}
        inverted
        keyboardLiftBehavior="always"
        extraContentPadding={composerHeight}
        offset={INPUT_BAR_HEIGHT + insets.bottom}
      />
    ),
    [composerHeight, insets.bottom]
  )

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: Spacing.three,
      paddingTop: INPUT_BAR_HEIGHT + insets.bottom,
    }),
    [insets.bottom]
  )

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <FlashList
        inverted
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={listContentStyle}
        renderScrollComponent={renderScrollComponent}
      />
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            onHeightChange={growth => {
              composerHeight.value = growth
            }}
          />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
    justifyContent: 'flex-start',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 18,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // iOS 26 Messages-style input bar
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  plusButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.select({ ios: 1, android: 4 }),
  },
  plusButtonText: {
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
  inputField: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 4, android: 4 }),
    maxHeight: 120,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Fonts.sans,
    maxHeight: 100,
    backgroundColor: 'transparent',
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.select({ ios: 1, android: 4 }),
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  micButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.select({ ios: 1, android: 4 }),
  },
  micButtonText: {
    fontSize: 20,
  },
})
