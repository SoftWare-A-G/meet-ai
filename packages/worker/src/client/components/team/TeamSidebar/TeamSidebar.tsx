import type { TeamInfo, TeamMember, TasksInfo, TaskItem } from '../../../lib/types'
import { ensureSenderContrast } from '../../../lib/colors'

type TeamSidebarProps = {
  teamInfo: TeamInfo
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

export default function TeamSidebar({ teamInfo, tasksInfo, isOpen, onClose }: TeamSidebarProps) {
  const active = teamInfo.members.filter(m => m.status === 'active')
  const inactive = teamInfo.members.filter(m => m.status === 'inactive')

  return (
    <div class={`team-sidebar${isOpen ? ' open' : ''}`}>
      <div class="team-sidebar-header">
        <span>Team</span>
        <span class="team-sidebar-count">{active.length}/{teamInfo.members.length}</span>
        <button class="team-sidebar-close-btn" onClick={onClose}>&times;</button>
      </div>
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
      <div class="team-section" style={{ display: tasksInfo && tasksInfo.tasks.length > 0 ? '' : 'none' }}>
        <div class="team-section-label">
          Tasks
          <span class="tasks-count">
            {(tasksInfo?.tasks ?? []).filter(t => t.status === 'completed').length}/{(tasksInfo?.tasks ?? []).length}
          </span>
        </div>
        {(tasksInfo?.tasks ?? []).filter(t => t.status === 'in_progress').map(t => <TaskRow key={t.id} task={t} />)}
        {(tasksInfo?.tasks ?? []).filter(t => t.status === 'pending').map(t => <TaskRow key={t.id} task={t} />)}
        {(tasksInfo?.tasks ?? []).filter(t => t.status === 'completed').map(t => <TaskRow key={t.id} task={t} />)}
      </div>
    </div>
  )
}
