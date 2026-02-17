import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeOut, SlideInDown } from 'react-native-reanimated'

type Props = {
  count: number
  onPress: () => void
}

function NewMessagesPillInner({ count, onPress }: Props) {
  if (count <= 0) return null

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.wrapper}
    >
      <Pressable style={styles.pill} onPress={onPress}>
        <Text style={styles.text}>
          {count} new {count === 1 ? 'message' : 'messages'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

export const NewMessagesPill = React.memo(NewMessagesPillInner)

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
})
