import { useRouter } from 'expo-router'
import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth-context'

export default function SettingsScreen() {
  const { apiKey, logout } = useAuth()
  const router = useRouter()
  const theme = useTheme()

  const keyPreview = apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : 'Not connected'

  function handleLogout() {
    Alert.alert('Disconnect', 'Remove your API key and return to login?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
        <Text style={[styles.value, { color: theme.text }]}>{keyPreview}</Text>
      </View>

      <Pressable
        style={[styles.logoutButton, { backgroundColor: theme.backgroundElement }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Disconnect</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  section: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 16, fontFamily: 'monospace' },
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
})
