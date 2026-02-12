import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Slot } from 'expo-router'
import React from 'react'
import { ActivityIndicator, View, useColorScheme } from 'react-native'

import { AuthProvider, useAuth } from '@/lib/auth-context'

function RootLayoutInner() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  )
}
