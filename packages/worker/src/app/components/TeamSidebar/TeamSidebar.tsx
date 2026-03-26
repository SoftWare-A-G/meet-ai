import clsx from 'clsx'
import { useState, useEffect } from 'react'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import { useHaptics } from '../../hooks/useHaptics'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useTeamInfoQuery } from '../../hooks/useTeamInfoQuery'
import { ensureSenderContrast } from '../../lib/colors'
import { formatRelativeTime } from '../../lib/dates'
import type { TaskItem } from '../../lib/fetchers'
import type { TeamMember } from '../../lib/types'

const TIMESTAMP_INTERVAL = 15_000

type TeamSidebarProps = {
  roomId: string
  isOpen: boolean
  onClose: () => void
  onOpenTaskBoard?: () => void
}

function MemberRow({
  member,
  inactive,
  roomId,
}: {
  member: TeamMember
  inactive?: boolean
  roomId: string
}) {
  const agentActivity = useAgentActivity(roomId)
  const activity = !inactive ? agentActivity.get(member.name) : undefined
  const hasActivity = activity && activity.latestAction

  const dotColor = inactive
    ? '#555'
    : activity?.state === 'working'
      ? '#22c55e'
      : ensureSenderContrast(member.color)

  return (
    <div className={clsx('px-4 py-[5px] text-[13px]', inactive && 'opacity-40')}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {member.name}
        </span>
        <span className="text-[11px] whitespace-nowrap opacity-40">{member.model}</span>
      </div>
      {hasActivity && (
        <div className="truncate pl-4 text-[11px] opacity-60">
          {activity.latestAction}
          {activity.lastActivityAt && (
            <span className="ml-1 opacity-70">
              &middot; {formatRelativeTime(activity.lastActivityAt)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: TaskItem }) {
  const statusIcon =
    task.status === 'completed' ? '\u2713' : task.status === 'in_progress' ? '\u25CF' : '\u25CB'
  const statusColor =
    task.status === 'completed'
      ? 'text-[#22c55e]'
      : task.status === 'in_progress'
        ? 'text-[#eab308]'
        : 'text-[#6b7280]'

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-[13px]">
      <span className={clsx('shrink-0 w-4 text-center text-xs', statusColor)}>{statusIcon}</span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{task.subject}</span>
      {task.owner && <span className="shrink-0 text-[11px] text-[#6b7280]">{task.owner}</span>}
    </div>
  )
}

function TeamSidebarContent({
  teamInfo,
  roomId,
  onOpenTaskBoard,
}: {
  teamInfo: NonNullable<ReturnType<typeof useTeamInfoQuery>['data']>
  roomId: string
  onOpenTaskBoard?: () => void
}) {
  const { trigger } = useHaptics()
  const { data: tasksData } = useTasksQuery(roomId)
  // Tick counter forces re-render every 15s so relative timestamps stay fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), TIMESTAMP_INTERVAL)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setTick(t => t + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  const active = teamInfo.members.filter(m => m.status === 'active')
  const inactive = teamInfo.members.filter(m => m.status === 'inactive')
  const tasks = tasksData?.tasks ?? []
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const pending = tasks.filter(t => t.status === 'pending')
  const completed = tasks.filter(t => t.status === 'completed')

  return (
    <>
      {tasks.length > 0 && (
        <div className="py-1">
          <div className="flex items-center px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase opacity-50">
            Tasks
            <span className="ml-1.5 text-[11px] text-[#6b7280]">
              {completed.length}/{tasks.length}
            </span>
            {onOpenTaskBoard && (
              <button
                type="button"
                onClick={() => {
                  trigger('light')
                  onOpenTaskBoard?.()
                }}
                className="text-sidebar-text hover:bg-hover-item ml-auto cursor-pointer rounded border-none bg-transparent p-0.5 text-[13px] leading-none opacity-50 hover:opacity-100"
                title="Open task board">
                &#9638;
              </button>
            )}
          </div>
          {inProgress.map(t => (
            <TaskRow key={t.id} task={t} />
          ))}
          {pending.map(t => (
            <TaskRow key={t.id} task={t} />
          ))}
          {completed.map(t => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
      {active.length > 0 && (
        <div className="py-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase opacity-50">
            Active
          </div>
          {active.map(m => (
            <MemberRow key={m.name} member={m} roomId={roomId} />
          ))}
        </div>
      )}
      {inactive.length > 0 && (
        <div className="py-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase opacity-50">
            Inactive
          </div>
          {inactive.map(m => (
            <MemberRow key={m.name} member={m} inactive roomId={roomId} />
          ))}
        </div>
      )}
    </>
  )
}

export default function TeamSidebar({
  roomId,
  isOpen,
  onClose,
  onOpenTaskBoard,
}: TeamSidebarProps) {
  const { data: teamInfo, isLoading: teamLoading } = useTeamInfoQuery(roomId)
  const activeCount = teamInfo?.members.filter(m => m.status === 'active').length ?? 0
  const totalCount = teamInfo?.members.length ?? 0

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[49] bg-black/50 [-webkit-tap-highlight-color:transparent] min-[981px]:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={clsx(
          'w-[330px] shrink-0 flex flex-col bg-sidebar-bg text-sidebar-text border-l border-b border-sidebar-border overflow-y-auto',
          'max-[980px]:fixed max-[980px]:top-0 max-[980px]:right-0 max-[980px]:z-50 max-[980px]:h-full',
          'max-[980px]:transition-transform max-[980px]:duration-[250ms] max-[980px]:ease-out',
          'max-[980px]:w-[330px] max-[980px]:max-w-[85vw]',
          isOpen ? 'max-[980px]:translate-x-0' : 'max-[980px]:translate-x-full'
        )}>
        <div className="border-sidebar-border flex h-12 shrink-0 items-center justify-between border-b px-4 text-sm font-bold">
          <span>Team</span>
          <span className="text-xs font-normal opacity-50">
            {teamInfo ? `${activeCount}/${totalCount}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-sidebar-text hover:bg-hover-item hidden cursor-pointer rounded border-none bg-transparent p-1 text-[22px] leading-none opacity-70 hover:opacity-100 max-[980px]:flex max-[980px]:items-center max-[980px]:justify-center">
            &times;
          </button>
        </div>
        {teamLoading && !teamInfo && (
          <div className="px-4 py-6 text-center text-[13px] text-[#888]">Loading team...</div>
        )}
        {teamInfo && (
          <TeamSidebarContent
            teamInfo={teamInfo}
            roomId={roomId}
            onOpenTaskBoard={onOpenTaskBoard}
          />
        )}
      </div>
    </>
  )
}
