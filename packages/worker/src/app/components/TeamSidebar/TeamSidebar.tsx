import type { TeamInfo, TeamMember, TasksInfo, TaskItem } from '../../lib/types'
import { ensureSenderContrast } from '../../lib/colors'

type TeamSidebarProps = {
  teamInfo: TeamInfo | null
  tasksInfo?: TasksInfo | null
  isOpen: boolean
  onClose: () => void
}

function MemberRow({ member, inactive }: { member: TeamMember; inactive?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-[5px] text-[13px]${inactive ? ' opacity-40' : ''}`}>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: inactive ? '#555' : ensureSenderContrast(member.color) }}
      />
      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{member.name}</span>
      <span className="text-[11px] opacity-40 whitespace-nowrap">{member.model}</span>
    </div>
  )
}

function TaskRow({ task }: { task: TaskItem }) {
  const statusIcon = task.status === 'completed' ? '\u2713'
    : task.status === 'in_progress' ? '\u25CF'
    : '\u25CB'
  const statusColor = task.status === 'completed' ? 'text-[#22c55e]'
    : task.status === 'in_progress' ? 'text-[#eab308]'
    : 'text-[#6b7280]'

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-[13px]">
      <span className={`shrink-0 w-4 text-center text-xs ${statusColor}`}>{statusIcon}</span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{task.subject}</span>
      {task.owner && <span className="text-[11px] text-[#6b7280] shrink-0">{task.owner}</span>}
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
        <div className="py-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-50">Active</div>
          {active.map(m => <MemberRow key={m.name} member={m} />)}
        </div>
      )}
      {inactive.length > 0 && (
        <div className="py-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-50">Inactive</div>
          {inactive.map(m => <MemberRow key={m.name} member={m} inactive />)}
        </div>
      )}
      {tasks.length > 0 && (
        <div className="py-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-50">
            Tasks
            <span className="text-[11px] text-[#6b7280] ml-1.5">{completed.length}/{tasks.length}</span>
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
  const activeCount = teamInfo?.members.filter(m => m.status === 'active').length ?? 0
  const totalCount = teamInfo?.members.length ?? 0

  return (
    <div className={`w-[330px] shrink-0 flex flex-col bg-sidebar-bg text-sidebar-text border-l border-sidebar-border overflow-y-auto max-[768px]:fixed max-[768px]:right-0 max-[768px]:z-50 max-[768px]:h-full max-[768px]:transition-transform max-[768px]:duration-[250ms] max-[768px]:ease-out max-[768px]:w-[330px] max-[768px]:max-w-[85vw] ${isOpen ? 'max-[768px]:translate-x-0' : 'max-[768px]:translate-x-full'}`}>
      <div className="px-4 font-bold text-sm border-b border-sidebar-border flex items-center justify-between h-14 shrink-0">
        <span>Team</span>
        <span className="text-xs font-normal opacity-50">{teamInfo ? `${activeCount}/${totalCount}` : ''}</span>
        <button className="hidden bg-transparent border-none text-sidebar-text cursor-pointer text-[22px] p-1 rounded leading-none opacity-70 hover:opacity-100 hover:bg-hover-item max-[768px]:flex max-[768px]:items-center max-[768px]:justify-center" onClick={onClose}>&times;</button>
      </div>
      {teamInfo && <TeamSidebarContent teamInfo={teamInfo} tasksInfo={tasksInfo} />}
    </div>
  )
}
