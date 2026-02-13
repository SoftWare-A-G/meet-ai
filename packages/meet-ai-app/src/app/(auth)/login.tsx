import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth-context'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const theme = useTheme()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    const trimmed = key.trim()
    if (!trimmed.startsWith('mai_')) {
      Alert.alert('Invalid key', 'API key must start with mai_')
      return
    }

    setLoading(true)
    try {
      await login(trimmed)
      router.replace('/(app)')
    } catch {
      Alert.alert('Connection failed', 'Could not connect with this API key. Check that it is correct.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>meet-ai</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your API key to connect
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            placeholder="mai_..."
            placeholderTextColor={theme.textSecondary}
            value={key}
            onChangeText={setKey}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            editable={!loading}
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={loading || !key.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
