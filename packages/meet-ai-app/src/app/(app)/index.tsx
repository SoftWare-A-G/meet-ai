import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useLobbyWebSocket } from '@/hooks/use-lobby-websocket'
import { useTheme } from '@/hooks/use-theme'
import { loadRooms } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Room } from '@/lib/types'

export default function RoomsScreen() {
  const { apiKey } = useAuth()
  const router = useRouter()
  const theme = useTheme()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRooms = useCallback(async () => {
    try {
      const data = await loadRooms()
      setRooms(data.sort((a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf()))
    } catch {
      Alert.alert('Error', 'Failed to load rooms')
    }
  }, [])

  useEffect(() => {
    if (!apiKey) return
    fetchRooms().finally(() => setLoading(false))
  }, [apiKey, fetchRooms])

  useLobbyWebSocket(apiKey, (id, name) => {
    setRooms((prev) => {
      if (prev.some((r) => r.id === id)) return prev
      return [{ id, name, created_at: new Date().toISOString() }, ...prev]
    })
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRooms()
    setRefreshing(false)
  }, [fetchRooms])

  function renderRoom({ item }: { item: Room }) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.roomRow,
          { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
        ]}
        onPress={() =>
          router.push({ pathname: '/(app)/rooms/[id]', params: { id: item.id, name: item.name } })
        }
      >
        <Text style={[styles.roomName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.roomDate, { color: theme.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Pressable>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.textSecondary }}>No rooms yet</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  roomRow: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: { fontSize: 16, fontWeight: '500' },
  roomDate: { fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 48 },
})
