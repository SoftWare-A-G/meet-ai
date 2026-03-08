import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import clsx from 'clsx'
import { useState, useCallback, useMemo, useEffect } from 'react'
import * as api from '../../lib/api'
import type { TaskItem, TasksInfo, TeamInfo, TeamMember } from '../../lib/types'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'

type TaskBoardModalProps = {
  roomId: string
  tasksInfo: TasksInfo | null
  teamInfo: TeamInfo | null
  onClose: () => void
}

const NEXT_STATUS: Record<TaskItem['status'], TaskItem['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
}

const STATUS_LABEL: Record<TaskItem['status'], string> = {
  pending: 'Start',
  in_progress: 'Complete',
  completed: 'Reopen',
}

function AssigneeDropdown({
  members,
  value,
  onChange,
  disabled,
}: {
  members: TeamMember[]
  value: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
}) {
  const display = value || 'Unassigned'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={clsx(
          'text-[11px] text-[#6b7280] hover:text-white transition-colors truncate max-w-[120px]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {display}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[140px]">
        <DropdownMenuItem
          className={clsx('text-[12px]', !value && 'text-white font-medium')}
          onClick={() => onChange(null)}
        >
          Unassigned
        </DropdownMenuItem>
        {members.map(m => (
          <DropdownMenuItem
            key={m.name}
            className={clsx('text-[12px]', value === m.name && 'text-white font-medium')}
            onClick={() => onChange(m.name)}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskCard({
  task,
  members,
  roomId,
  onOptimisticUpdate,
  inflight,
  onInflightChange,
}: {
  task: TaskItem
  members: TeamMember[]
  roomId: string
  onOptimisticUpdate: (updated: TaskItem) => void
  inflight: boolean
  onInflightChange: (taskId: string, pending: boolean) => void
}) {
  const statusColor = task.status === 'completed' ? 'border-l-[#22c55e]'
    : task.status === 'in_progress' ? 'border-l-[#eab308]'
    : 'border-l-[#6b7280]'

  const handleStatusClick = useCallback(async () => {
    if (inflight) return
    const newStatus = NEXT_STATUS[task.status]
    onOptimisticUpdate({ ...task, status: newStatus })
    onInflightChange(task.id, true)
    try {
      await api.updateTask(roomId, task.id, { status: newStatus })
    } catch {
      onOptimisticUpdate(task)
    } finally {
      onInflightChange(task.id, false)
    }
  }, [task, roomId, onOptimisticUpdate, inflight, onInflightChange])

  const handleAssigneeChange = useCallback(async (assignee: string | null) => {
    if (inflight) return
    onOptimisticUpdate({ ...task, assignee })
    onInflightChange(task.id, true)
    try {
      await api.updateTask(roomId, task.id, { assignee })
    } catch {
      onOptimisticUpdate(task)
    } finally {
      onInflightChange(task.id, false)
    }
  }, [task, roomId, onOptimisticUpdate, inflight, onInflightChange])

  return (
    <div className={clsx('rounded-md border border-border bg-white/[0.04] p-2.5 border-l-[3px]', statusColor)}>
      <div className="text-[13px] leading-snug">{task.subject}</div>
      {task.description && (
        <div className="mt-1 text-[11px] opacity-50 line-clamp-2">{task.description}</div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <AssigneeDropdown
          members={members}
          value={task.assignee}
          onChange={handleAssigneeChange}
          disabled={inflight}
        />
        <button
          type="button"
          onClick={handleStatusClick}
          disabled={inflight}
          className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
            inflight && 'opacity-50 cursor-not-allowed',
            task.status === 'pending' && 'border-[#6b7280] text-[#6b7280] hover:bg-[#6b7280]/20',
            task.status === 'in_progress' && 'border-[#eab308] text-[#eab308] hover:bg-[#eab308]/20',
            task.status === 'completed' && 'border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/20',
          )}
        >
          {STATUS_LABEL[task.status]}
        </button>
      </div>
    </div>
  )
}

function Column({
  title,
  tasks,
  count,
  members,
  roomId,
  onOptimisticUpdate,
  inflightIds,
  onInflightChange,
}: {
  title: string
  tasks: TaskItem[]
  count: number
  members: TeamMember[]
  roomId: string
  onOptimisticUpdate: (updated: TaskItem) => void
  inflightIds: Set<string>
  onInflightChange: (taskId: string, pending: boolean) => void
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-[11px] text-[#6b7280] bg-white/[0.08] rounded-full px-1.5 py-0.5 leading-none">{count}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1">
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            members={members}
            roomId={roomId}
            onOptimisticUpdate={onOptimisticUpdate}
            inflight={inflightIds.has(t.id)}
            onInflightChange={onInflightChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-[12px] text-[#6b7280] text-center py-4 opacity-50">No tasks</div>
        )}
      </div>
    </div>
  )
}

export default function TaskBoardModal({ roomId, tasksInfo, teamInfo, onClose }: TaskBoardModalProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [optimisticTasks, setOptimisticTasks] = useState<TaskItem[]>([])
  const [inflightIds, setInflightIds] = useState<Set<string>>(new Set())

  const members = teamInfo?.members ?? []

  // Clear optimistic entries when WS catches up (same state)
  useEffect(() => {
    if (optimisticTasks.length === 0) return
    const stale = optimisticTasks.filter(ot => {
      const ws = tasksInfo?.tasks?.find(t => t.id === ot.id)
      if (!ws) return false
      return ws.status === ot.status && ws.assignee === ot.assignee
    })
    if (stale.length > 0) {
      const staleIds = new Set(stale.map(t => t.id))
      setOptimisticTasks(prev => prev.filter(t => !staleIds.has(t.id)))
    }
  }, [tasksInfo, optimisticTasks])

  const tasks = useMemo(() => {
    const wsTasks = tasksInfo?.tasks ?? []
    const wsMap = new Map(wsTasks.map(t => [t.id, t]))
    // Merge: optimistic always overrides WS
    for (const ot of optimisticTasks) {
      wsMap.set(ot.id, ot)
    }
    return [...wsMap.values()]
  }, [tasksInfo, optimisticTasks])

  const pending = tasks.filter(t => t.status === 'pending')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const completed = tasks.filter(t => t.status === 'completed')

  const handleOptimisticUpdate = useCallback((updated: TaskItem) => {
    setOptimisticTasks(prev => {
      const filtered = prev.filter(t => t.id !== updated.id)
      return [...filtered, updated]
    })
  }, [])

  const handleInflightChange = useCallback((taskId: string, pending: boolean) => {
    setInflightIds(prev => {
      const next = new Set(prev)
      if (pending) next.add(taskId)
      else next.delete(taskId)
      return next
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent & { currentTarget: HTMLFormElement }) => {
    e.preventDefault()
    const trimmed = subject.trim()
    if (!trimmed || submitting) return

    setError('')
    setSubmitting(true)
    try {
      const result = await api.createTask(roomId, trimmed, description.trim() || undefined, assignee)
      setOptimisticTasks(prev => [...prev, result.task])
      setSubject('')
      setDescription('')
      setAssignee(null)
    } catch {
      setError('Failed to create task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [roomId, subject, description, assignee, submitting])

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] w-[800px] max-w-[95vw] sm:max-w-[800px] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-lg">Task Board</DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              className="border-border text-msg-text flex-1 rounded-md border bg-white/10 px-2.5 py-2 text-[13px]"
              type="text"
              placeholder="New task subject..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={500}
            />
            {members.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="border-border text-msg-text rounded-md border bg-white/10 px-2 py-2 text-[13px] min-w-[120px] text-left">
                  {assignee || 'Unassigned'}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setAssignee(null)}>
                    Unassigned
                  </DropdownMenuItem>
                  {members.map(m => (
                    <DropdownMenuItem key={m.name} onClick={() => setAssignee(m.name)}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                      {m.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              type="submit"
              disabled={!subject.trim() || submitting}
            >
              Add
            </Button>
          </div>
          <textarea
            className="border-border text-msg-text mt-2 w-full rounded-md border bg-white/10 px-2.5 py-2 text-[13px] resize-y"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
          />
          {error && <div className="mt-1 text-[12px] text-[#ef4444]">{error}</div>}
        </form>

        <div className="flex gap-4 max-[600px]:flex-col">
          <Column title="Pending" tasks={pending} count={pending.length} members={members} roomId={roomId} onOptimisticUpdate={handleOptimisticUpdate} inflightIds={inflightIds} onInflightChange={handleInflightChange} />
          <Column title="In Progress" tasks={inProgress} count={inProgress.length} members={members} roomId={roomId} onOptimisticUpdate={handleOptimisticUpdate} inflightIds={inflightIds} onInflightChange={handleInflightChange} />
          <Column title="Completed" tasks={completed} count={completed.length} members={members} roomId={roomId} onOptimisticUpdate={handleOptimisticUpdate} inflightIds={inflightIds} onInflightChange={handleInflightChange} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
