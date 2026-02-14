import { useCallback } from 'react'
import type { PendingMessage } from '../lib/types'

function openMessageQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('meet-ai-queue', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'tempId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function queueMessage(msg: PendingMessage): Promise<void> {
  const db = await openMessageQueue()
  const tx = db.transaction('outbox', 'readwrite')
  tx.objectStore('outbox').put(msg)
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready
    await (reg as any).sync.register('send-messages')
  }
}

async function removeFromQueue(tempId: string): Promise<void> {
  try {
    const db = await openMessageQueue()
    const tx = db.transaction('outbox', 'readwrite')
    tx.objectStore('outbox').delete(tempId)
  } catch { /* ignore */ }
}

async function getQueuedMessages(roomId: string): Promise<PendingMessage[]> {
  const db = await openMessageQueue()
  const tx = db.transaction('outbox', 'readonly')
  const req = tx.objectStore('outbox').getAll()
  const all = await new Promise<PendingMessage[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return all.filter(m => m.roomId === roomId)
}

async function getAllQueued(): Promise<PendingMessage[]> {
  const db = await openMessageQueue()
  const tx = db.transaction('outbox', 'readonly')
  const req = tx.objectStore('outbox').getAll()
  return new Promise<PendingMessage[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useOfflineQueue() {
  const queue = useCallback(queueMessage, [])
  const remove = useCallback(removeFromQueue, [])
  const getForRoom = useCallback(getQueuedMessages, [])
  const getAll = useCallback(getAllQueued, [])

  return { queue, remove, getForRoom, getAll }
}
