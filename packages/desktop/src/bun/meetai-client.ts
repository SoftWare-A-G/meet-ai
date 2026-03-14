import { hc } from 'hono/client'
import type { AppType } from '../../../worker/src/index'
import type { Credentials } from './auth'

// --- Types ---

export type TeamMember = {
	teammate_id: string
	name: string
	color: string
	role: string
	model: string
	status: 'active' | 'inactive'
	joinedAt: number
}

export type StoredTask = {
	id: string
	subject: string
	description?: string
	status: string
	assignee?: string
}

export type CommandInfo = {
	name: string
	type: string
	description: string
	source?: string
}

export type RoomMessage = {
	id: string
	sender: string
	content: string
	color?: string
	sender_type: string
	seq: number
	created_at: string
}

export type Room = {
	id: string
	name: string
	created_at: string
}

export type MeetAiEvent =
	| { type: 'team_info'; team_name: string; members: TeamMember[] }
	| { type: 'tasks_info'; tasks: StoredTask[] }
	| { type: 'commands_info'; commands: CommandInfo[] }
	| {
			type: 'message'
			sender: string
			content: string
			color?: string
			sender_type: string
			seq?: number
	  }
	| { type: 'log'; sender: string; content: string }
	| { type: 'terminal_data'; data: string }

type EventType = MeetAiEvent['type']
type EventOfType<T extends EventType> = Extract<MeetAiEvent, { type: T }>
type EventHandler<T extends EventType> = (event: EventOfType<T>) => void

// --- Client ---

export class MeetAiClient {
	private credentials: Credentials
	private client: ReturnType<typeof hc<AppType>>
	private ws: WebSocket | null = null
	private listeners = new Map<string, Set<Function>>()
	private lastSeq = 0
	private reconnectAttempt = 0
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private currentRoomId: string | null = null
	private shouldReconnect = false

	constructor(credentials: Credentials) {
		this.credentials = credentials
		this.client = hc<AppType>(credentials.url, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${credentials.key}`,
			},
		})
	}

	// --- REST ---

	async listRooms(): Promise<Room[]> {
		const res = await this.client.api.rooms.$get()
		if (!res.ok) throw new Error(`Failed to list rooms: ${res.status}`)
		return (await res.json()) as Room[]
	}

	async getMessages(
		roomId: string,
		sinceSeq?: number,
	): Promise<RoomMessage[]> {
		const res = await this.client.api.rooms[':id'].messages.$get({
			param: { id: roomId },
			query: sinceSeq !== undefined ? { since_seq: sinceSeq.toString() } : {},
		})
		if (!res.ok) throw new Error(`Failed to get messages: ${res.status}`)
		return (await res.json()) as RoomMessage[]
	}

	// --- WebSocket ---

	connect(roomId: string): void {
		this.currentRoomId = roomId
		this.shouldReconnect = true
		this.reconnectAttempt = 0
		this.openWebSocket()
	}

	disconnect(): void {
		this.shouldReconnect = false
		this.currentRoomId = null
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.ws) {
			this.ws.close()
			this.ws = null
		}
	}

	// --- Event emitter ---

	on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set())
		const handlers = this.listeners.get(type)!
		handlers.add(handler)
		return () => handlers.delete(handler)
	}

	private emit<T extends EventType>(event: EventOfType<T>): void {
		const handlers = this.listeners.get(event.type)
		if (!handlers) return
		for (const handler of handlers) {
			handler(event)
		}
	}

	// --- Internal ---

	private openWebSocket(): void {
		if (!this.currentRoomId) return

		const wsUrl = this.credentials.url
			.replace(/^http/, 'ws')
			.concat(`/api/rooms/${this.currentRoomId}/ws?token=${this.credentials.key}`)

		this.ws = new WebSocket(wsUrl)

		this.ws.onopen = () => {
			this.reconnectAttempt = 0
		}

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(String(event.data)) as MeetAiEvent
				if (data.type === 'message' && data.seq !== undefined) {
					this.lastSeq = data.seq
				}
				this.emit(data)
			} catch {
				// ignore malformed messages
			}
		}

		this.ws.onclose = () => {
			this.ws = null
			if (this.shouldReconnect) this.scheduleReconnect()
		}

		this.ws.onerror = () => {
			// onclose will fire after onerror
		}
	}

	private scheduleReconnect(): void {
		const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000)
		this.reconnectAttempt++
		this.reconnectTimer = setTimeout(async () => {
			this.reconnectTimer = null
			// Catch up missed messages before reconnecting WebSocket
			if (this.currentRoomId && this.lastSeq > 0) {
				try {
					const missed = await this.getMessages(
						this.currentRoomId,
						this.lastSeq,
					)
					for (const msg of missed) {
						this.lastSeq = msg.seq
						this.emit({
							type: 'message',
							sender: msg.sender,
							content: msg.content,
							color: msg.color,
							sender_type: msg.sender_type,
							seq: msg.seq,
						})
					}
				} catch {
					// will retry on next reconnect
				}
			}
			this.openWebSocket()
		}, delay)
	}
}
