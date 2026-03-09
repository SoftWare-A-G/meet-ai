import { getMeetAiConfig } from '@meet-ai/cli/config'
import type { MeetAiClient } from '@meet-ai/cli/types'
import HttpTransport from './adapters/HttpTransport'
import ConnectionAdapter from './adapters/ConnectionAdapter'
import FileSystemAdapter from './adapters/FileSystemAdapter'
import MessageRepository from './repositories/MessageRepository'
import ProjectRepository from './repositories/ProjectRepository'
import RoomRepository from './repositories/RoomRepository'
import AttachmentRepository from './repositories/AttachmentRepository'
import SendMessage from './usecases/SendMessage'
import CreateRoom from './usecases/CreateRoom'
import DeleteRoom from './usecases/DeleteRoom'
import UpdateRoom from './usecases/UpdateRoom'
import ListRooms from './usecases/ListRooms'
import SendLog from './usecases/SendLog'
import SendTeamInfo from './usecases/SendTeamInfo'
import SendCommands from './usecases/SendCommands'
import SendTasks from './usecases/SendTasks'
import SendTerminalData from './usecases/SendTerminalData'
import UpsertProject from './usecases/UpsertProject'
import InboxRouter from './services/InboxRouter'
import Listen from './usecases/Listen'
import ListenLobby from './usecases/ListenLobby'
import Poll from './usecases/Poll'
import GenerateKey from './usecases/GenerateKey'
import GetAttachments from './usecases/GetAttachments'
import DownloadAttachment from './usecases/DownloadAttachment'

const ATTACHMENTS_DIR = '/tmp/meet-ai-attachments'
const MAX_AGE_MS = 5 * 60 * 1000

function cleanupOldAttachments(): void {
  try {
    const { readdirSync, statSync, unlinkSync } = require('node:fs') as typeof import('node:fs')
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

function createContainer() {
  const config = getMeetAiConfig()

  // Transport layer
  const transport = new HttpTransport(config.url, config.key)

  // Repositories
  const messageRepository = new MessageRepository(transport)
  const projectRepository = new ProjectRepository(transport)
  const roomRepository = new RoomRepository(transport)
  const attachmentRepository = new AttachmentRepository(transport)

  // Adapters
  const connectionAdapter = new ConnectionAdapter(transport, config.url, config.key)
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

export function getContainer() {
  if (!container) {
    container = createContainer()
  }
  return container
}

/**
 * Facade: wraps the domain container into a MeetAiClient interface.
 * Allows incremental migration — command usecases keep their existing
 * (client: MeetAiClient, ...) signatures while the backing implementation
 * moves to the domain layer.
 */
export function getClient(): MeetAiClient {
  const c = getContainer()
  return {
    listRooms: () => c.listRooms.execute(),
    createRoom: (name, projectId) => c.createRoom.execute(name, projectId),
    updateRoom: (roomId, fields) => c.updateRoom.execute(roomId, fields),
    findProject: (id) => c.findProject(id),
    upsertProject: (id, name) => c.upsertProject.execute(id, name),
    sendMessage: (roomId, sender, content, color) =>
      c.sendMessage.execute(roomId, sender, content, color),
    getMessages: (roomId, options) =>
      c.poll.execute(roomId, options),
    listen: (roomId, options) =>
      c.listen.execute(roomId, options),
    sendLog: (roomId, sender, content, color, messageId) =>
      c.sendLog.execute(roomId, sender, content, { color, messageId }),
    sendTeamInfo: (roomId, payload) =>
      c.sendTeamInfo.execute(roomId, payload),
    sendCommands: (roomId, payload) =>
      c.sendCommands.execute(roomId, payload),
    sendTasks: (roomId, payload) =>
      c.sendTasks.execute(roomId, payload),
    getMessageAttachments: (roomId, messageId) =>
      c.getAttachments.execute(roomId, messageId),
    downloadAttachment: async (attachmentId) => {
      cleanupOldAttachments()
      const response = await c.downloadAttachment.execute(attachmentId)
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync(ATTACHMENTS_DIR, { recursive: true })
      const safeId = attachmentId.replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown'
      const localPath = `${ATTACHMENTS_DIR}/${safeId}.bin`
      const buffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(localPath, buffer)
      return localPath
    },
    listenLobby: (options) =>
      c.listenLobby.execute(options),
    generateKey: () =>
      c.generateKey.execute(),
    deleteRoom: (roomId) =>
      c.deleteRoom.execute(roomId),
    sendTerminalData: (roomId, data) =>
      c.sendTerminalData.execute(roomId, data),
  }
}
