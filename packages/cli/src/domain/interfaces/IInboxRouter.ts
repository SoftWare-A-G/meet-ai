export interface InboxEntry {
  from: string
  text: string
  timestamp: string
  read: boolean
  attachments?: string[]
}

export interface RouteOptions {
  inboxDir: string
  defaultInboxPath: string | null
  teamDir: string
  attachmentPaths?: string[]
}

export interface IdleCheckOptions {
  inboxDir: string
  teamDir: string
  inbox: string
  defaultInboxPath: string | null
  notified: Set<string>
}

export default interface IInboxRouter {
  route(msg: { sender: string; content?: string }, opts: RouteOptions): void
  checkIdle(opts: IdleCheckOptions): void
}
