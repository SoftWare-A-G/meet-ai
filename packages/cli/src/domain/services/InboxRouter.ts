import { dirname } from 'node:path'
import type IFileSystem from '@meet-ai/cli/domain/interfaces/IFileSystem'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'
import type {
  InboxEntry,
  RouteOptions,
  IdleCheckOptions,
} from '@meet-ai/cli/domain/interfaces/IInboxRouter'

const IDLE_THRESHOLD_MS = 5 * 60 * 1000

export default class InboxRouter implements IInboxRouter {
  constructor(private readonly fs: IFileSystem) {}

  route(msg: { sender: string; content?: string }, opts: RouteOptions): void {
    if (typeof msg.content !== 'string') return

    const entry: InboxEntry = {
      from: `meet-ai:${msg.sender}`,
      text: msg.content,
      timestamp: new Date().toISOString(),
      read: false,
    }
    if (opts.attachmentPaths?.length) {
      entry.attachments = opts.attachmentPaths
    }

    const members = this.getTeamMembers(opts.teamDir)
    const targets = this.resolveInboxTargets(msg.content, members)

    if (targets) {
      for (const target of targets) {
        this.appendToInbox(`${opts.inboxDir}/${target}.json`, entry)
      }
    } else if (opts.defaultInboxPath) {
      this.appendToInbox(opts.defaultInboxPath, entry)
    }
  }

  checkIdle(opts: IdleCheckOptions): void {
    const members = this.getTeamMembers(opts.teamDir)
    const newlyIdle = this.checkIdleAgents(opts.inboxDir, members, opts.inbox, opts.notified)
    for (const agent of newlyIdle) {
      opts.notified.add(agent)
      if (opts.defaultInboxPath) {
        this.appendToInbox(opts.defaultInboxPath, {
          from: 'meet-ai:idle-check',
          text: `${agent} idle for 5+ minutes`,
          timestamp: new Date().toISOString(),
          read: false,
        })
      }
    }
  }

  private appendToInbox(path: string, entry: InboxEntry): void {
    this.fs.mkdirSync(dirname(path), { recursive: true })
    let messages: unknown[] = []
    try {
      messages = JSON.parse(this.fs.readFileSync(path, 'utf-8'))
    } catch {}
    messages.push(entry)
    this.fs.writeFileSync(path, JSON.stringify(messages, null, 2))
  }

  private getTeamMembers(teamDir: string): Set<string> {
    try {
      const config = JSON.parse(this.fs.readFileSync(`${teamDir}/config.json`, 'utf-8'))
      return new Set(config.members?.map((m: { name: string }) => m.name) || [])
    } catch {
      return new Set()
    }
  }

  private resolveInboxTargets(content: string, members: Set<string>): string[] | null {
    const mentions = content.match(/@([\w-]+)/g)
    if (!mentions) return null

    const valid = [...new Set(mentions.map(m => m.slice(1)))].filter(name => members.has(name))
    return valid.length > 0 ? valid : null
  }

  private checkIdleAgents(
    inboxDir: string,
    members: Set<string>,
    excludeAgent: string,
    notified: Set<string>,
    now: number = Date.now()
  ): string[] {
    const newlyIdle: string[] = []
    for (const member of members) {
      if (member === excludeAgent) continue

      const inboxPath = `${inboxDir}/${member}.json`
      let mtime: number
      try {
        mtime = this.fs.statSync(inboxPath).mtimeMs
      } catch {
        continue
      }

      const idleMs = now - mtime
      if (idleMs >= IDLE_THRESHOLD_MS) {
        if (!notified.has(member)) {
          newlyIdle.push(member)
        }
      } else {
        notified.delete(member)
      }
    }
    return newlyIdle
  }
}
