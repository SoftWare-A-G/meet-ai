import { jsonString } from '@meet-ai/worker/schemas/helpers'
import { lobbyBroadcastSchema } from '@meet-ai/worker/schemas/lobby'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useCallback } from 'react'
import { queryKeys } from '../lib/query-keys'
import type { RoomsResponse, ProjectsResponse } from '../lib/fetchers'
import type { SpawnRequest } from '@meet-ai/worker/schemas/lobby'

export function useLobbyWebSocket(apiKey: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingSpawnRef = useRef(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    if (!apiKey) return
    const key = apiKey

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(key)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/lobby/ws${tokenParam}`)

      ws.onmessage = e => {
        const result = jsonString.pipe(lobbyBroadcastSchema).safeParse(e.data)
        if (!result.success) return
        const evt = result.data
        if (evt.type === 'room_deleted') {
          void queryClient.cancelQueries({ queryKey: queryKeys.rooms.all })
          queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old =>
            old ? old.filter(r => r.id !== evt.id) : []
          )
          return
        }
        if (evt.type === 'room_created') {
          void queryClient.cancelQueries({ queryKey: queryKeys.rooms.all })
          queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old => {
            if (old?.some(r => r.id === evt.id)) return old
            return [
              {
                id: evt.id,
                name: evt.name,
                project_id: evt.project_id ?? null,
                created_at: evt.created_at,
                connected: false,
              },
              ...(old ?? []),
            ]
          })
          if (pendingSpawnRef.current) {
            pendingSpawnRef.current = false
            void router.navigate({ to: '/chat/$id', params: { id: evt.id } })
          }
          if (
            evt.project_id &&
            evt.project_name &&
            evt.project_created_at &&
            evt.project_updated_at
          ) {
            void queryClient.cancelQueries({ queryKey: queryKeys.projects.all })
            queryClient.setQueryData<ProjectsResponse>(queryKeys.projects.all, old => {
              if (old?.some(p => p.id === evt.project_id)) return old
              return [
                ...(old ?? []),
                {
                  id: evt.project_id!,
                  name: evt.project_name!,
                  created_at: evt.project_created_at!,
                  updated_at: evt.project_updated_at!,
                },
              ]
            })
          }
        }
      }

      ws.onclose = () => {
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, 3000)
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [apiKey, queryClient, router])

  const send = useCallback((data: SpawnRequest) => {
    pendingSpawnRef.current = true
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
