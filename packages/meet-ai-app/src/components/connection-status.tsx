import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import type { ConnectionStatus as ConnectionStatusType } from '@/lib/types'

type Props = {
  status: ConnectionStatusType
}

function ConnectionStatusInner({ status }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (status === 'reconnecting') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      )
      animation.start()
      return () => animation.stop()
    }
    pulseAnim.setValue(1)
  }, [status, pulseAnim])

  if (status === 'connected') return null

  if (status === 'reconnecting') {
    return (
      <Animated.View
        style={[styles.bar, styles.reconnecting, { opacity: pulseAnim }]}
        accessibilityRole="alert"
        accessibilityLabel="Reconnecting to server"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.dot}>{'●'}</Text>
        <Text style={styles.text}>Reconnecting...</Text>
      </Animated.View>
    )
  }

  // offline
  return (
    <View
      style={[styles.bar, styles.offline]}
      accessibilityRole="alert"
      accessibilityLabel="Offline. Messages will be sent when reconnected"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.dot}>{'●'}</Text>
      <Text style={styles.text}>Offline — messages will be sent when reconnected</Text>
    </View>
  )
}

export const ConnectionStatus = React.memo(ConnectionStatusInner)

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  reconnecting: {
    backgroundColor: '#f59e0b',
  },
  offline: {
    backgroundColor: '#ef4444',
  },
  dot: {
    color: '#fff',
    fontSize: 10,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})
