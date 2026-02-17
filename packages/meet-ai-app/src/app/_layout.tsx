import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { Slot, useRouter, useSegments } from 'expo-router'
import React, { useEffect } from 'react'
import { ActivityIndicator, Alert, View, useColorScheme } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { claimToken } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth-context'

function DeepLinkHandler() {
  const { login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    function handleUrl(event: { url: string }) {
      const parsed = Linking.parse(event.url)
      if (parsed.path?.startsWith('auth/')) {
        const token = parsed.path.replace('auth/', '')
        if (token) {
          claimToken(token)
            .then(async ({ api_key }) => {
              await login(api_key)
              router.replace('/(app)')
            })
            .catch(() => {
              Alert.alert('Link expired', 'This share link is no longer valid.')
            })
        }
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    const subscription = Linking.addEventListener('url', handleUrl)
    return () => subscription.remove()
  }, [login, router])

  return null
}

function RootLayoutInner() {
  const { apiKey, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!apiKey && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (apiKey && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [apiKey, isLoading, segments, router])

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <>
      <DeepLinkHandler />
      <Slot />
    </>
  )
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <KeyboardProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <RootLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </KeyboardProvider>
  )
}
