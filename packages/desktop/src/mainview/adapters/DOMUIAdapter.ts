import { classifyAgent } from '../constants'
import { getMoodLabel, getMoodEmoji } from '../domain/services/AgentClassifier'
import type { IUIAdapter, HUDData } from '../domain/interfaces/IUIAdapter'
import type { AgentData, EventLogEntry } from '../types'

export class DOMUIAdapter implements IUIAdapter {
  private readonly roomTitleEl: HTMLDivElement
  private readonly agentCountEl: HTMLDivElement
  private readonly hudTeamXP: HTMLSpanElement
  private readonly hudMVP: HTMLSpanElement
  private readonly hudTasks: HTMLSpanElement
  private readonly hudGuildLv: HTMLSpanElement
  private readonly hudReputation: HTMLSpanElement
  private readonly eventLogPanel: HTMLDivElement
  private readonly eventLogEntries: HTMLDivElement
  private agentPanel: HTMLDivElement | null = null

  constructor() {
    // Room title
    this.roomTitleEl = document.createElement('div')
    this.roomTitleEl.className = 'room-title'
    this.roomTitleEl.textContent = 'Connecting...'
    document.body.appendChild(this.roomTitleEl)

    // Agent count
    this.agentCountEl = document.createElement('div')
    this.agentCountEl.className = 'agent-count'
    this.agentCountEl.textContent = '0 agents'
    document.body.appendChild(this.agentCountEl)

    // HUD panel
    const hudPanel = document.createElement('div')
    hudPanel.className = 'hud-panel'
    const hudTitle = document.createElement('div')
    hudTitle.className = 'hud-title'
    hudTitle.textContent = 'Guild Stats'
    hudPanel.appendChild(hudTitle)
    hudPanel.appendChild(this.createHudRow('Team XP', 'hud-team-xp'))
    hudPanel.appendChild(this.createHudRow('MVP', 'hud-mvp'))
    hudPanel.appendChild(this.createHudRow('Quests', 'hud-tasks'))
    hudPanel.appendChild(this.createHudRow('Guild Lv', 'hud-guild-lv'))
    hudPanel.appendChild(this.createHudRow('Reputation', 'hud-reputation'))
    document.body.appendChild(hudPanel)

    this.hudTeamXP = document.getElementById('hud-team-xp') as HTMLSpanElement
    this.hudMVP = document.getElementById('hud-mvp') as HTMLSpanElement
    this.hudTasks = document.getElementById('hud-tasks') as HTMLSpanElement
    this.hudGuildLv = document.getElementById('hud-guild-lv') as HTMLSpanElement
    this.hudReputation = document.getElementById('hud-reputation') as HTMLSpanElement

    // Event log panel
    this.eventLogPanel = document.createElement('div')
    this.eventLogPanel.className = 'event-log collapsed'
    const eventLogTitle = document.createElement('div')
    eventLogTitle.className = 'event-log-title'
    eventLogTitle.textContent = 'Event Log [L]'
    this.eventLogPanel.appendChild(eventLogTitle)
    this.eventLogEntries = document.createElement('div')
    this.eventLogEntries.className = 'event-log-entries'
    this.eventLogPanel.appendChild(this.eventLogEntries)
    document.body.appendChild(this.eventLogPanel)
  }

  setRoomTitle(title: string): void {
    this.roomTitleEl.textContent = title
  }

  updateAgentCount(active: number, total: number): void {
    this.agentCountEl.textContent = `${active} active / ${total} agents`
  }

  updateHUD(data: HUDData): void {
    this.hudTeamXP.textContent = String(data.totalXP)
    this.hudMVP.textContent = data.mvpXP > 0 ? `${data.mvpName} (${data.mvpXP})` : '\u2014'
    this.hudTasks.textContent = `${data.activeTasks} active / ${data.completedTasks} done`
    this.hudGuildLv.textContent = String(data.guildLevel)
    this.hudReputation.textContent = data.reputation
  }

  showAgentPanel(
    agent: AgentData,
    specialty: { name: string; icon: string },
    onAction: (action: string) => void
  ): void {
    if (this.agentPanel) this.agentPanel.remove()

    const cls = classifyAgent(agent.name, agent.role)
    const moodLabel = getMoodLabel(agent)
    const moodIcon = getMoodEmoji(moodLabel)

    const panel = document.createElement('div')
    panel.className = 'agent-panel'

    // Class title
    const classDiv = document.createElement('div')
    classDiv.className = 'agent-panel-class'
    classDiv.textContent = cls.title
    panel.appendChild(classDiv)

    // Name
    const nameDiv = document.createElement('div')
    nameDiv.className = 'agent-panel-name'
    nameDiv.style.color = agent.color
    nameDiv.textContent = `${agent.name} Lv.${agent.level}`
    panel.appendChild(nameDiv)

    // Specialty + mood
    const specDiv = document.createElement('div')
    specDiv.className = 'agent-panel-specialty'
    specDiv.textContent = `${specialty.icon} ${specialty.name} ${moodIcon} ${moodLabel}`
    panel.appendChild(specDiv)

    // Stat bars
    const barsDiv = document.createElement('div')
    barsDiv.className = 'agent-panel-bars'
    for (const [label, value, color] of [
      ['Focus', agent.focus, '#3b82f6'],
      ['Fatigue', agent.fatigue, '#f59e0b'],
      ['Mood', agent.mood, '#22c55e'],
    ] as [string, number, string][]) {
      const bar = document.createElement('div')
      bar.className = 'stat-bar-container'
      const lbl = document.createElement('span')
      lbl.className = 'stat-bar-label'
      lbl.textContent = label
      const track = document.createElement('div')
      track.className = 'stat-bar-track'
      const fill = document.createElement('div')
      fill.className = 'stat-bar-fill'
      fill.style.width = `${value}%`
      fill.style.background = color
      track.appendChild(fill)
      const val = document.createElement('span')
      val.className = 'stat-bar-value'
      val.textContent = String(Math.round(value))
      bar.appendChild(lbl)
      bar.appendChild(track)
      bar.appendChild(val)
      barsDiv.appendChild(bar)
    }
    panel.appendChild(barsDiv)

    // Stats grid
    const statsDiv = document.createElement('div')
    statsDiv.className = 'agent-panel-stats'
    for (const [sLabel, sValue] of [
      ['Quests', agent.tasksCompleted],
      ['Tools', agent.toolUses],
      ['Msgs', agent.messagesCount],
      ['XP', agent.xp],
    ] as [string, number][]) {
      const stat = document.createElement('div')
      stat.className = 'agent-panel-stat'
      const sv = document.createElement('div')
      sv.className = 'agent-panel-stat-value'
      sv.textContent = String(sValue)
      const sl = document.createElement('div')
      sl.className = 'agent-panel-stat-label'
      sl.textContent = sLabel
      stat.appendChild(sv)
      stat.appendChild(sl)
      statsDiv.appendChild(stat)
    }
    panel.appendChild(statsDiv)

    // Action buttons
    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'agent-panel-actions'
    for (const [action, text] of [
      ['boost', 'Boost'],
      ['recover', 'Recover'],
      ['reroute', 'Reroute'],
    ]) {
      const btn = document.createElement('button')
      btn.className = `agent-panel-btn ${action}`
      btn.dataset.action = action
      btn.textContent = text
      actionsDiv.appendChild(btn)
    }
    panel.appendChild(actionsDiv)
    document.body.appendChild(panel)
    this.agentPanel = panel

    // Action handlers
    panel.querySelectorAll('.agent-panel-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const action = (e.currentTarget as HTMLElement).dataset.action
        if (action) onAction(action)
      })
    })
  }

  hideAgentPanel(): void {
    if (this.agentPanel) {
      this.agentPanel.remove()
      this.agentPanel = null
    }
  }

  refreshEventLog(entries: readonly EventLogEntry[]): void {
    const colorMap: Record<string, string> = {
      tool: '#3b82f6',
      message: '#eab308',
      task: '#22c55e',
      error: '#ef4444',
    }
    while (this.eventLogEntries.firstChild)
      this.eventLogEntries.removeChild(this.eventLogEntries.firstChild)
    for (const e of entries) {
      const d = new Date(e.time)
      const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const div = document.createElement('div')
      div.className = 'event-entry'
      div.style.color = colorMap[e.type] || '#888'
      div.textContent = `[${ts}] ${e.agent}: ${e.text}`
      this.eventLogEntries.appendChild(div)
    }
    this.eventLogEntries.scrollTop = this.eventLogEntries.scrollHeight
  }

  toggleEventLog(visible: boolean): void {
    this.eventLogPanel.classList.toggle('collapsed', !visible)
  }

  private createHudRow(labelText: string, valueId: string): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'hud-row'
    const label = document.createElement('span')
    label.className = 'hud-label'
    label.textContent = labelText
    const value = document.createElement('span')
    value.className = 'hud-value'
    value.id = valueId
    value.textContent = labelText === 'Team XP' ? '0' : labelText === 'Quests' ? '0 / 0' : '\u2014'
    row.appendChild(label)
    row.appendChild(value)
    return row
  }
}
