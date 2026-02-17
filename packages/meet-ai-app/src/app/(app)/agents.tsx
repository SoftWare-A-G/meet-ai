import { useLocalSearchParams } from 'expo-router'
import React, { useMemo } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'
import type { TeamInfo, TeamMember } from '@/lib/types'

export default function AgentsScreen() {
  const { teamInfoJson } = useLocalSearchParams<{ teamInfoJson: string }>()
  const theme = useTheme()

  const teamInfo: TeamInfo | null = useMemo(() => {
    if (!teamInfoJson) return null
    try {
      return JSON.parse(teamInfoJson)
    } catch {
      return null
    }
  }, [teamInfoJson])

  const members = teamInfo?.members ?? []

  function renderAgent({ item }: { item: TeamMember }) {
    const isActive = item.status === 'active'

    return (
      <View
        style={[styles.agentRow, { backgroundColor: theme.backgroundElement }]}
        accessible
        accessibilityLabel={`${item.name}, ${item.role}, ${isActive ? 'active' : 'inactive'}`}
      >
        <View style={[styles.avatar, { backgroundColor: item.color }]}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: item.color }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? '#22c55e' : '#9ca3af' },
              ]}
              accessibilityLabel={isActive ? 'Active' : 'Inactive'}
            />
          </View>
          <Text style={[styles.role, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.role}
          </Text>
          {item.model ? (
            <Text style={[styles.model, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.model}
            </Text>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {teamInfo?.team_name ? (
        <Text style={[styles.teamName, { color: theme.text }]}>{teamInfo.team_name}</Text>
      ) : null}
      <FlatList
        data={members}
        keyExtractor={(item) => item.name}
        renderItem={renderAgent}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.textSecondary }}>No agents in this room</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  teamName: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: { padding: 16, gap: 8 },
  agentRow: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  role: { fontSize: 13 },
  model: { fontSize: 12, opacity: 0.7 },
  empty: { alignItems: 'center', marginTop: 48 },
})
