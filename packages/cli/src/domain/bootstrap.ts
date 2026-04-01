import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { getMeetAiConfig } from '@meet-ai/cli/config'
import { Result } from 'better-result'
import { createApiClient } from './adapters/api-client'
import ConnectionAdapter from './adapters/ConnectionAdapter'
import FileSystemAdapter from './adapters/FileSystemAdapter'
import AttachmentRepository from './repositories/AttachmentRepository'
import MessageRepository from './repositories/MessageRepository'
import ProjectRepository from './repositories/ProjectRepository'
import RoomRepository from './repositories/RoomRepository'
import InboxRouter from './services/InboxRouter'
import CreateRoom from './usecases/CreateRoom'
import DeleteRoom from './usecases/DeleteRoom'
import DownloadAttachment from './usecases/DownloadAttachment'
import GenerateKey from './usecases/GenerateKey'
import GetAttachments from './usecases/GetAttachments'
import Listen from './usecases/Listen'
import ListenLobby from './usecases/ListenLobby'
import ListRooms from './usecases/ListRooms'
import Poll from './usecases/Poll'
import SendCommands from './usecases/SendCommands'
import SendLog from './usecases/SendLog'
import SendMessage from './usecases/SendMessage'
import SendTasks from './usecases/SendTasks'
import SendTeamInfo from './usecases/SendTeamInfo'
import SendTerminalData from './usecases/SendTerminalData'
import UpdateRoom from './usecases/UpdateRoom'
import UpsertProject from './usecases/UpsertProject'
import type { MeetAiConfig } from '@meet-ai/cli/config'
import type { MeetAiClient } from '@meet-ai/cli/types'

const ATTACHMENTS_DIR = '/tmp/meet-ai-attachments'
const MAX_AGE_MS = 5 * 60 * 1000

function cleanupOldAttachments(): void {
  try {
    const now = Date.now()
    for (const entry of readdirSync(ATTACHMENTS_DIR)) {
      try {
        const filePath = `${ATTACHMENTS_DIR}/${entry}`
        const mtime = statSync(filePath).mtimeMs
        if (now - mtime > MAX_AGE_MS) {
          unlinkSync(filePath)
        }
      } catch {
        // Ignore per-file errors
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
}

function createContainer(configOverride?: MeetAiConfig) {
  const config = configOverride ?? getMeetAiConfig()

  // Transport layer
  const client = createApiClient(config.url, config.key)

  // Repositories
  const messageRepository = new MessageRepository(client)
  const projectRepository = new ProjectRepository(client)
  const roomRepository = new RoomRepository(client)
  const attachmentRepository = new AttachmentRepository(client)

  // Adapters
  const connectionAdapter = new ConnectionAdapter(client, config.url, config.key)
  const fileSystem = new FileSystemAdapter()

  // Services
  const inboxRouter = new InboxRouter(fileSystem)

  // Use cases
  return {
    sendMessage: new SendMessage(messageRepository),
    listRooms: new ListRooms(roomRepository),
    createRoom: new CreateRoom(roomRepository),
    findProject: (id: string) => projectRepository.find(id),
    upsertProject: new UpsertProject(projectRepository),
    updateRoom: new UpdateRoom(roomRepository),
    deleteRoom: new DeleteRoom(roomRepository),
    sendLog: new SendLog(messageRepository),
    sendTeamInfo: new SendTeamInfo(roomRepository),
    sendCommands: new SendCommands(roomRepository),
    sendTasks: new SendTasks(roomRepository),
    sendTerminalData: new SendTerminalData(roomRepository),
    listen: new Listen(connectionAdapter, messageRepository),
    listenLobby: new ListenLobby(connectionAdapter),
    poll: new Poll(messageRepository),
    generateKey: new GenerateKey(connectionAdapter),
    getAttachments: new GetAttachments(attachmentRepository),
    downloadAttachment: new DownloadAttachment(attachmentRepository),
    inboxRouter,
  }
}

// Lazy singleton — created on first access
let container: ReturnType<typeof createContainer> | null = null

export function getContainer(configOverride?: MeetAiConfig) {
  if (configOverride) {
    container = createContainer(configOverride)
  }
  if (!container) {
    container = createContainer()
  }
  return container
}

function unwrap<T>(result: Result<T, { message: string }>): T {
  if (result.isErr()) throw new Error(result.error.message)
  return result.value
}

/**
 * Facade: wraps the domain container into a MeetAiClient interface.
 * Allows incremental migration — command usecases keep their existing
 * (client: MeetAiClient, ...) signatures while the backing implementation
 * moves to the domain layer.
 */
export function getClient(configOverride?: MeetAiConfig): MeetAiClient {
  const c = getContainer(configOverride)
  return {
    listRooms: async () => unwrap(await c.listRooms.execute()),
    createRoom: async (name, projectId) => unwrap(await c.createRoom.execute(name, projectId)),
    updateRoom: async (roomId, fields) => unwrap(await c.updateRoom.execute(roomId, fields)),
    findProject: async id => unwrap(await c.findProject(id)),
    upsertProject: async (id, name) => unwrap(await c.upsertProject.execute(id, name)),
    sendMessage: async (roomId, sender, content, color) =>
      unwrap(await c.sendMessage.execute(roomId, sender, content, color)),
    getMessages: async (roomId, options) => unwrap(await c.poll.execute(roomId, options)),
    listen: (roomId, options) => c.listen.execute(roomId, options),
    sendLog: async (roomId, sender, content, color, messageId) =>
      unwrap(await c.sendLog.execute(roomId, sender, content, { color, messageId })),
    sendTeamInfo: async (roomId, payload) => unwrap(await c.sendTeamInfo.execute(roomId, payload)),
    sendCommands: async (roomId, payload) => unwrap(await c.sendCommands.execute(roomId, payload)),
    sendTasks: async (roomId, payload) => unwrap(await c.sendTasks.execute(roomId, payload)),
    getMessageAttachments: async (roomId, messageId) =>
      unwrap(await c.getAttachments.execute(roomId, messageId)),
    downloadAttachment: async attachmentId => {
      cleanupOldAttachments()
      const response = unwrap(await c.downloadAttachment.execute(attachmentId))
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync(ATTACHMENTS_DIR, { recursive: true })
      const safeId = attachmentId.replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown'
      const localPath = `${ATTACHMENTS_DIR}/${safeId}.bin`
      const buffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(localPath, buffer)
      return localPath
    },
    listenLobby: options => c.listenLobby.execute(options),
    generateKey: async () => unwrap(await c.generateKey.execute()),
    deleteRoom: async roomId => unwrap(await c.deleteRoom.execute(roomId)),
    sendTerminalData: async (roomId, data) => {
      await c.sendTerminalData.execute(roomId, data)
      // Result intentionally not checked — terminal data is ephemeral
    },
  }
}
