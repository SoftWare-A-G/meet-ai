import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { wsUrl, loadMessagesSinceSeq, sendMessage } from '@/lib/api'
import type { Message, TeamInfo, ConnectionStatus } from '@/lib/types'

const MIN_BACKOFF = 1000
const MAX_BACKOFF = 30000
const SEND_TIMEOUT = 10000
const RECONNECTING_DEBOUNCE = 500

let localCounter = 0

type QueuedMessage = {
  localId: string
  roomId: string
  sender: string
  content: string
}

export function useRoomWebSocket(
  roomId: string | null,
  apiKey: string | null,
  onMessage: (msg: Message) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const lastSeqRef = useRef<number>(0)
  const backoffRef = useRef<number>(MIN_BACKOFF)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected')
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const offlineQueueRef = useRef<QueuedMessage[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced setter: avoid flicker by not showing "reconnecting" for brief disconnects
  const setDebouncedStatus = useCallback((status: ConnectionStatus) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (status === 'reconnecting') {
      debounceTimerRef.current = setTimeout(() => {
        setConnectionStatus('reconnecting')
        debounceTimerRef.current = null
      }, RECONNECTING_DEBOUNCE)
    } else {
      setConnectionStatus(status)
    }
  }, [])

  // Update a message in state by localId
  const updateMessageByLocalId = useCallback((localId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.localId === localId ? { ...m, ...updates } : m))
  }, [])

  // Add incoming message, dedup by id and localId
  const addIncomingMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      // Check for duplicate by server id
      if (prev.some(m => m.id === msg.id)) return prev
      // Check if this matches an optimistic message (same content + sender from us)
      const optimisticIdx = prev.findIndex(
        m => m.localId && m.status === 'sending' && m.content === msg.content && m.sender === msg.sender
      )
      if (optimisticIdx !== -1) {
        // Replace optimistic message with server-confirmed one
        const updated = [...prev]
        updated[optimisticIdx] = { ...msg, status: 'sent', localId: prev[optimisticIdx].localId }
        return updated
      }
      return [...prev, msg]
    })
    onMessageRef.current(msg)
  }, [])

  // Send a message optimistically
  const sendOptimistic = useCallback(async (sender: string, content: string) => {
    if (!roomId) return

    const localId = `local_${++localCounter}`
    const optimisticMsg: Message = {
      id: localId,
      room_id: roomId,
      sender,
      sender_type: 'human',
      content,
      color: null,
      type: 'message',
      seq: null,
      created_at: new Date().toISOString(),
      status: 'sending',
      localId,
    }

    setMessages(prev => [...prev, optimisticMsg])

    // If offline, queue it
    if (connectionStatus === 'offline' || connectionStatus === 'reconnecting') {
      offlineQueueRef.current.push({ localId, roomId, sender, content })
      return
    }

    // Send via HTTP
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), SEND_TIMEOUT)
      )
      const serverMsg = await Promise.race([sendMessage(roomId, sender, content), timeoutPromise])
      updateMessageByLocalId(localId, {
        id: serverMsg.id,
        seq: serverMsg.seq,
        status: 'sent',
        created_at: serverMsg.created_at,
      })
    } catch {
      updateMessageByLocalId(localId, { status: 'failed' })
    }
  }, [roomId, connectionStatus, updateMessageByLocalId])

  // Retry a failed message
  const retryMessage = useCallback(async (localId: string) => {
    if (!roomId) return

    let msgToRetry: Message | undefined
    setMessages(prev => {
      msgToRetry = prev.find(m => m.localId === localId)
      return prev.map(m => m.localId === localId ? { ...m, status: 'sending' as const } : m)
    })

    if (!msgToRetry) return

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), SEND_TIMEOUT)
      )
      const serverMsg = await Promise.race([
        sendMessage(roomId, msgToRetry.sender, msgToRetry.content),
        timeoutPromise,
      ])
      updateMessageByLocalId(localId, {
        id: serverMsg.id,
        seq: serverMsg.seq,
        status: 'sent',
        created_at: serverMsg.created_at,
      })
    } catch {
      updateMessageByLocalId(localId, { status: 'failed' })
    }
  }, [roomId, updateMessageByLocalId])

  // Flush offline queue
  const flushQueue = useCallback(async () => {
    const queue = [...offlineQueueRef.current]
    offlineQueueRef.current = []

    for (const item of queue) {
      try {
        const serverMsg = await sendMessage(item.roomId, item.sender, item.content)
        updateMessageByLocalId(item.localId, {
          id: serverMsg.id,
          seq: serverMsg.seq,
          status: 'sent',
          created_at: serverMsg.created_at,
        })
      } catch {
        updateMessageByLocalId(item.localId, { status: 'failed' })
      }
    }
  }, [updateMessageByLocalId])

  useEffect(() => {
    if (!roomId || !apiKey) return

    async function catchUp() {
      if (!roomId || lastSeqRef.current === 0) return
      try {
        const missed = await loadMessagesSinceSeq(roomId, lastSeqRef.current)
        for (const msg of missed) {
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          addIncomingMessage(msg)
        }
      } catch { /* ignore */ }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const ws = new WebSocket(wsUrl(`/api/rooms/${roomId}/ws`, apiKey!))

      ws.onopen = () => {
        setDebouncedStatus('connected')
        backoffRef.current = MIN_BACKOFF
        catchUp()
        flushQueue()
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'team_info') {
            setTeamInfo(data as TeamInfo)
            return
          }
          const msg = data as Message
          if (!msg.sender || !msg.content) return
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          addIncomingMessage(msg)
        } catch { /* ignore */ }
      }

      ws.onerror = () => {
        console.error('WebSocket error')
        if (wsRef.current === ws) setDebouncedStatus('reconnecting')
      }
      ws.onclose = () => {
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF)
        if (wsRef.current === ws) {
          // If backoff is high enough, we're offline
          if (delay >= MAX_BACKOFF / 2) {
            setDebouncedStatus('offline')
          } else {
            setDebouncedStatus('reconnecting')
          }
          setTimeout(() => connect(), delay)
        }
      }

      wsRef.current = ws
    }

    connect()

    function handleAppState(state: AppStateStatus) {
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          backoffRef.current = MIN_BACKOFF
          connect()
        } else {
          catchUp()
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppState)

    return () => {
      subscription.remove()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      setDebouncedStatus('reconnecting')
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [roomId, apiKey, addIncomingMessage, setDebouncedStatus, flushQueue])

  return { connectionStatus, teamInfo, messages, sendOptimistic, retryMessage }
}
