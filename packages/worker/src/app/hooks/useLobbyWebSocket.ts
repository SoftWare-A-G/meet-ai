import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import type { RoomsResponse, ProjectsResponse } from '../lib/fetchers'

type LobbyEvent =
  | {
      type: 'room_created'
      id: string
      name: string
      created_at: string
      project_id?: string | null
      project_name?: string | null
      project_created_at?: string | null
      project_updated_at?: string | null
    }
  | { type: 'room_deleted'; id: string }

function parseLobbyEvent(raw: string): LobbyEvent | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function useLobbyWebSocket(apiKey: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!apiKey) return
    const key = apiKey

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(key)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/lobby/ws${tokenParam}`)

      ws.onmessage = e => {
        const evt = parseLobbyEvent(e.data)
        if (!evt) return
        if (evt.type === 'room_created') {
          queryClient.setQueryData<RoomsResponse>(queryKeys.rooms.all, old => {
            if (old?.some(r => r.id === evt.id)) return old
            return [{ id: evt.id, name: evt.name, project_id: evt.project_id ?? null, created_at: evt.created_at }, ...(old ?? [])]
          })
          if (evt.project_id && evt.project_name && evt.project_created_at && evt.project_updated_at) {
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
  }, [apiKey, queryClient])

  const send = useCallback((data: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
