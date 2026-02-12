import { Stack } from 'expo-router'
import React from 'react'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Rooms' }} />
      <Stack.Screen name="rooms/[id]" options={{ title: 'Chat' }} />
      <Stack.Screen name="agents" options={{ title: 'Agents' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  )
}
