export interface InboxEntry {
  from: string
  text: string
  timestamp: string
  read: boolean
  attachments?: string[]
}

export interface RouteOptions {
  inboxDir: string
  inbox: string
  teamDir: string
  roomId: string
  attachmentPaths?: string[]
}

export interface IdleCheckOptions {
  inboxDir: string
  teamDir: string
  roomId: string
  inbox: string
  notified: Set<string>
}

export default interface IInboxRouter {
  route(msg: { sender: string; content?: string }, opts: RouteOptions): void
  checkIdle(opts: IdleCheckOptions): void
}
