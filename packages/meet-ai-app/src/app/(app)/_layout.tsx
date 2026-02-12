import { Tabs } from 'expo-router'
import React from 'react'

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Rooms' }} />
      <Tabs.Screen name="rooms/[id]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
