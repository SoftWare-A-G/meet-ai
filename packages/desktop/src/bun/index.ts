import { BrowserWindow, defineElectrobunRPC } from 'electrobun/bun'
import { loadCredentials } from './auth'
import { showErrorScreen } from './error-screen'
import { MeetAiClient } from './meetai-client'
import { selectRoom } from './room-selector'
import type { MeetAiRPCSchema } from '../shared/rpc-schema'

// ─── Auth ───

const credentials = loadCredentials()
if (!credentials) {
  showErrorScreen('No credentials found. Please configure meet-ai first.')
  setInterval(() => {}, 60000)
  throw new Error('No credentials')
}

// ─── Room Selection ───

const client = new MeetAiClient(credentials)

let selectedRoom: Awaited<ReturnType<typeof selectRoom>> = null
try {
  selectedRoom = await selectRoom(client)
} catch (err) {
  showErrorScreen(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`)
  setInterval(() => {}, 60000)
  throw err
}

if (!selectedRoom) {
  showErrorScreen('No rooms found. Create a room with meet-ai first.')
  setInterval(() => {}, 60000)
  throw new Error('No rooms')
}

// ─── RPC Bridge ───

const rpc = defineElectrobunRPC<MeetAiRPCSchema, 'bun'>('bun', {
  handlers: {
    requests: {},
    messages: {},
  },
})

// Electrobun's RPC Proxy accepts any message name at runtime but the
// generic type plumbing in defineElectrobunRPC doesn't resolve the
// message keys properly. Cast to a typed send function.
type BunMessages = MeetAiRPCSchema['bun']['messages']
const send = rpc.send as unknown as <K extends keyof BunMessages>(
  name: K,
  payload: BunMessages[K]
) => void

// ─── Browser Window ───

const win = new BrowserWindow({
  title: `Meet AI — ${selectedRoom.name}`,
  url: 'views://mainview/index.html',
  frame: { width: 1280, height: 800, x: 100, y: 100 },
  rpc,
})

// Belt-and-suspenders: also call loadURL explicitly in case the constructor
// doesn't reliably pass the URL to the native webview init.
win.webview.loadURL('views://mainview/index.html')

// ─── Forward WebSocket Events to Webview ───

client.on('team_info', data => {
  console.log(`[game] team_info: ${data.members.length} members in "${data.team_name}"`)
  send('meetai:team_info', data)
})

client.on('message', data => {
  console.log(`[game] message: ${data.sender}: ${data.content.slice(0, 60)}`)
  send('meetai:message', data)
})

client.on('tasks_info', data => {
  console.log(`[game] tasks_info: ${data.tasks.length} tasks`)
  send('meetai:tasks_info', data)
})

client.on('log', data => {
  console.log(`[game] log: ${data.sender}: ${data.content.slice(0, 60)}`)
  send('meetai:log', data)
})

client.on('commands_info', data => {
  console.log(`[game] commands_info: ${data.commands.length} commands`)
  send('meetai:commands_info', data)
})

// Wait for the webview to finish loading before connecting to meet-ai.
// Without this, the first team_info can arrive before the webview's user code
// executes — the preload's default receiveMessageFromBun handler just logs and
// discards the message, so the webview never receives the initial state.
win.webview.on('dom-ready', () => {
  console.log('[rpc] Webview dom-ready, connecting to meet-ai…')
  client.connect(selectedRoom.id)
  console.log(`[meet-ai] Connected to room: ${selectedRoom.name}`)
})

// ─── Cleanup ───

win.on('close', () => {
  client.disconnect()
})
