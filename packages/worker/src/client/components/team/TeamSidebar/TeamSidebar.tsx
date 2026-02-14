import { useEffect, useRef } from 'hono/jsx/dom'
import { render } from 'hono/jsx/dom'
import type { TeamInfo, TeamMember, TasksInfo, TaskItem } from '../../../lib/types'
import { ensureSenderContrast } from '../../../lib/colors'

type TeamSidebarProps = {
  teamInfo: TeamInfo | null
  tasksInfo?: TasksInfo | null
  isOpen: boolean
  onClose: () => void
}

function MemberRow({ member, inactive }: { member: TeamMember; inactive?: boolean }) {
  return (
    <div class={`team-member${inactive ? ' team-member--inactive' : ''}`}>
      <span
        class="team-member-dot"
        style={{ background: inactive ? '#555' : ensureSenderContrast(member.color) }}
      />
      <span class="team-member-name">{member.name}</span>
      <span class="team-member-model">{member.model}</span>
    </div>
  )
}

function TaskRow({ task }: { task: TaskItem }) {
  const statusIcon = task.status === 'completed' ? '\u2713'
    : task.status === 'in_progress' ? '\u25CF'
    : '\u25CB'
  const statusClass = `task-status task-status--${task.status.replace('_', '-')}`

  return (
    <div class="task-row">
      <span class={statusClass}>{statusIcon}</span>
      <span class="task-subject">{task.subject}</span>
      {task.owner && <span class="task-owner">{task.owner}</span>}
    </div>
  )
}

function TeamSidebarContent({ teamInfo, tasksInfo }: { teamInfo: TeamInfo; tasksInfo?: TasksInfo | null }) {
  const active = teamInfo.members.filter(m => m.status === 'active')
  const inactive = teamInfo.members.filter(m => m.status === 'inactive')
  const tasks = tasksInfo?.tasks ?? []
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')
  const completed = tasks.filter(t => t.status === 'completed')

  return (
    <>
      {active.length > 0 && (
        <div class="team-section">
          <div class="team-section-label">Active</div>
          {active.map(m => <MemberRow key={m.name} member={m} />)}
        </div>
      )}
      {inactive.length > 0 && (
        <div class="team-section">
          <div class="team-section-label">Inactive</div>
          {inactive.map(m => <MemberRow key={m.name} member={m} inactive />)}
        </div>
      )}
      {tasks.length > 0 && (
        <div class="team-section">
          <div class="team-section-label">
            Tasks
            <span class="tasks-count">{completed.length}/{tasks.length}</span>
          </div>
          {inProgress.map(t => <TaskRow key={t.id} task={t} />)}
          {pending.map(t => <TaskRow key={t.id} task={t} />)}
          {completed.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </>
  )
}

export default function TeamSidebar({ teamInfo, tasksInfo, isOpen, onClose }: TeamSidebarProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Render content in a separate render root to bypass hono/jsx/dom reconciler bugs
  // (cannot diff children arrays that change length, cannot handle false→component transitions)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (!teamInfo) {
      el.innerHTML = ''
      return
    }
    render(<TeamSidebarContent teamInfo={teamInfo} tasksInfo={tasksInfo} />, el)
  }, [teamInfo, tasksInfo])

  const activeCount = teamInfo?.members.filter(m => m.status === 'active').length ?? 0
  const totalCount = teamInfo?.members.length ?? 0

  return (
    <div class={`team-sidebar${isOpen ? ' open' : ''}`}>
      <div class="team-sidebar-header">
        <span>Team</span>
        <span class="team-sidebar-count">{teamInfo ? `${activeCount}/${totalCount}` : ''}</span>
        <button class="team-sidebar-close-btn" onClick={onClose}>&times;</button>
      </div>
      <div ref={bodyRef} />
    </div>
  )
}
