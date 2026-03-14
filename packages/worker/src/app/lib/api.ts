import { STORAGE_KEYS } from './constants'
import type { Message, Project, Room, TaskItem, TasksInfo, TeamInfo } from './types'

export function getApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.apiKey)
}

export function setApiKey(key: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.apiKey, key)
}

export function clearApiKey(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEYS.apiKey)
}

function authHeaders(): Record<string, string> {
  const key = getApiKey()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) h['Authorization'] = `Bearer ${key}`
  return h
}

export async function loadRooms(): Promise<Room[]> {
  const res = await fetch('/api/rooms', { headers: authHeaders() })
  if (res.status === 401) {
    clearApiKey()
    location.href = '/key'
    return []
  }
  return res.json()
}

export async function loadProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects', { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Rename project failed: HTTP ${res.status}`)
  return res.json()
}

export async function renameRoom(roomId: string, name: string): Promise<Room> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Rename room failed: HTTP ${res.status}`)
  return res.json()
}

export async function updateRoomProject(roomId: string, projectId: string | null): Promise<Room> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ project_id: projectId }),
  })
  if (!res.ok) throw new Error(`Update room project failed: HTTP ${res.status}`)
  return res.json()
}

export async function deleteRoom(roomId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Delete room failed: HTTP ${res.status}`)
}

export async function loadMessages(roomId: string): Promise<Message[]> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function loadMessagesSinceSeq(roomId: string, sinceSeq: number): Promise<Message[]> {
  const res = await fetch(`/api/rooms/${roomId}/messages?since_seq=${sinceSeq}`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function loadLogs(roomId: string): Promise<Message[]> {
  const res = await fetch(`/api/rooms/${roomId}/logs`, { headers: authHeaders() })
  if (!res.ok) return []
  const logs: Message[] = await res.json()
  return logs.map(l => ({ ...l, type: 'log' as const }))
}

export async function sendMessage(roomId: string, sender: string, content: string, attachmentIds?: string[]): Promise<{ id: string }> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sender, content, ...(attachmentIds?.length && { attachment_ids: attachmentIds }) }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function claimToken(token: string): Promise<{ api_key: string }> {
  const res = await fetch(`/api/auth/claim/${encodeURIComponent(token)}`)
  if (!res.ok) throw new Error('Link expired or invalid')
  return res.json()
}

export async function shareAuth(): Promise<{ url: string }> {
  const res = await fetch('/api/auth/share', {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to create share link')
  return res.json()
}

export async function uploadFile(roomId: string, file: File): Promise<{ id: string; filename: string; size: number }> {
  const key = getApiKey()
  const headers: Record<string, string> = {}
  if (key) headers['Authorization'] = `Bearer ${key}`
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/rooms/${roomId}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`)
  return res.json()
}

export async function linkAttachment(attachmentId: string, messageId: string): Promise<void> {
  const res = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ message_id: messageId }),
  })
  if (!res.ok) throw new Error(`Link failed: HTTP ${res.status}`)
}

export async function loadAttachmentCounts(roomId: string): Promise<Record<string, number>> {
  const res = await fetch(`/api/rooms/${roomId}/attachment-counts`, { headers: authHeaders() })
  if (!res.ok) return {}
  return res.json()
}

export async function loadTasks(roomId: string): Promise<TasksInfo | null> {
  const res = await fetch(`/api/rooms/${roomId}/tasks`, { headers: authHeaders() })
  if (!res.ok) return null
  const data: { tasks?: TaskItem[] } = await res.json()
  return { tasks: data.tasks ?? [] }
}

export async function loadTeamInfo(roomId: string): Promise<TeamInfo | null> {
  const res = await fetch(`/api/rooms/${roomId}/team-info`, { headers: authHeaders() })
  if (!res.ok) return null
  return await res.json()
}

export async function checkTtsAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/tts/status', { headers: authHeaders() })
    if (!res.ok) return false
    const data: { available: boolean } = await res.json()
    return data.available
  } catch {
    return false
  }
}

export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`TTS failed: HTTP ${res.status}`)
  return res.arrayBuffer()
}

export async function answerQuestionReview(
  roomId: string,
  reviewId: string,
  answers: Record<string, string>,
  answeredBy?: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/question-reviews/${reviewId}/answer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ answers, answered_by: answeredBy || 'anonymous' }),
  })
  if (!res.ok) throw new Error(`Question review answer failed: HTTP ${res.status}`)
  return res.json()
}

export async function decidePlanReview(
  roomId: string,
  reviewId: string,
  approved: boolean,
  feedback?: string,
  decidedBy?: string,
  permissionMode?: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/plan-reviews/${reviewId}/decide`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      approved,
      decided_by: decidedBy || 'anonymous',
      ...(feedback && { feedback }),
      ...(permissionMode && { permission_mode: permissionMode }),
    }),
  })
  if (!res.ok) throw new Error(`Plan review decide failed: HTTP ${res.status}`)
  return res.json()
}

export async function decidePermissionReview(
  roomId: string,
  reviewId: string,
  approved: boolean,
  decidedBy?: string,
  feedback?: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/permission-reviews/${reviewId}/decide`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      approved,
      decided_by: decidedBy || 'anonymous',
      ...(feedback && { feedback }),
    }),
  })
  if (!res.ok) throw new Error(`Permission review decide failed: HTTP ${res.status}`)
  return res.json()
}

export async function createTask(
  roomId: string,
  subject: string,
  description?: string,
  assignee?: string | null,
): Promise<{ ok: boolean; task: TaskItem }> {
  const res = await fetch(`/api/rooms/${roomId}/tasks/create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      subject,
      ...(description && { description }),
      ...(assignee !== undefined && { assignee }),
      source: 'meet_ai',
      updated_by: 'human',
    }),
  })
  if (!res.ok) throw new Error(`Create task failed: HTTP ${res.status}`)
  return res.json()
}

export async function updateTask(
  roomId: string,
  taskId: string,
  updates: Partial<Pick<TaskItem, 'subject' | 'description' | 'status' | 'assignee'>>,
): Promise<{ ok: boolean; task: TaskItem }> {
  const res = await fetch(`/api/rooms/${roomId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ ...updates, updated_by: 'human' }),
  })
  if (!res.ok) throw new Error(`Update task failed: HTTP ${res.status}`)
  return res.json()
}

export async function deleteTask(roomId: string, taskId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Delete task failed: HTTP ${res.status}`)
  return res.json()
}

export async function expirePlanReview(
  roomId: string,
  reviewId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/plan-reviews/${reviewId}/expire`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Plan review expire failed: HTTP ${res.status}`)
  return res.json()
}

// Canvas API helpers

export type CanvasMetadata = {
  id: string
  room_id: string
  title: string | null
  created_at: string
  updated_at: string
  ws_url?: string
  snapshot_url?: string
}

export async function ensureCanvas(roomId: string): Promise<CanvasMetadata> {
  const res = await fetch(`/api/rooms/${roomId}/canvas`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Ensure canvas failed: HTTP ${res.status}`)
  return res.json()
}

export async function loadCanvas(roomId: string): Promise<CanvasMetadata | null> {
  const res = await fetch(`/api/rooms/${roomId}/canvas`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Load canvas failed: HTTP ${res.status}`)
  return res.json()
}

export async function loadCanvasSnapshot(roomId: string): Promise<{ canvas_id: string; room_id: string; snapshot: unknown }> {
  const res = await fetch(`/api/rooms/${roomId}/canvas/snapshot`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Load canvas snapshot failed: HTTP ${res.status}`)
  return res.json()
}

export async function applyCanvasMutations(
  roomId: string,
  mutations: { puts?: { id: string; [key: string]: unknown }[]; deletes?: string[] },
): Promise<{ canvas_id: string; room_id: string; ok: boolean }> {
  const res = await fetch(`/api/rooms/${roomId}/canvas/mutations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(mutations),
  })
  if (!res.ok) throw new Error(`Apply canvas mutations failed: HTTP ${res.status}`)
  return res.json()
}
