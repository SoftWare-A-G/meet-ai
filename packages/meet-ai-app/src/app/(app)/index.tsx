import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from 'expo-router'

import { useLobbyWebSocket } from '@/hooks/use-lobby-websocket'
import { useTheme } from '@/hooks/use-theme'
import { createRoom, loadRooms } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Room } from '@/lib/types'

export default function RoomsScreen() {
  const { apiKey } = useAuth()
  const router = useRouter()
  const navigation = useNavigation()
  const theme = useTheme()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const fetchRooms = useCallback(async () => {
    try {
      const data = await loadRooms()
      setRooms(data)
    } catch {
      Alert.alert('Error', 'Failed to load rooms')
    }
  }, [])

  useEffect(() => {
    if (!apiKey) return
    fetchRooms().finally(() => setLoading(false))
  }, [apiKey, fetchRooms])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setShowCreate((v) => !v)} style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: '#3c87f7', fontSize: 28, fontWeight: '300' }}>+</Text>
        </Pressable>
      ),
    })
  }, [navigation])

  useLobbyWebSocket(apiKey, (id, name) => {
    setRooms((prev) => {
      if (prev.some((r) => r.id === id)) return prev
      return [...prev, { id, name, created_at: new Date().toISOString() }]
    })
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRooms()
    setRefreshing(false)
  }, [fetchRooms])

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      const room = await createRoom(trimmed)
      setRooms((prev) => [...prev, room])
      setNewName('')
      setShowCreate(false)
    } catch {
      Alert.alert('Error', 'Failed to create room')
    }
  }

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
      {showCreate && (
        <View style={[styles.createBar, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[
              styles.createInput,
              { color: theme.text, borderColor: theme.backgroundSelected },
            ]}
            placeholder="Room name..."
            placeholderTextColor={theme.textSecondary}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
      )}

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
  createBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'center',
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
})
