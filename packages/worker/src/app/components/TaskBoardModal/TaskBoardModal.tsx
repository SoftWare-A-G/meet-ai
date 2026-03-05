import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import clsx from 'clsx'
import { useState, useCallback, useMemo } from 'react'
import * as api from '../../lib/api'
import type { TaskItem, TasksInfo } from '../../lib/types'
import { Button } from '../ui/button'

type TaskBoardModalProps = {
  roomId: string
  tasksInfo: TasksInfo | null
  onClose: () => void
}

function TaskCard({ task }: { task: TaskItem }) {
  const statusColor = task.status === 'completed' ? 'border-l-[#22c55e]'
    : task.status === 'in_progress' ? 'border-l-[#eab308]'
    : 'border-l-[#6b7280]'

  return (
    <div className={clsx('rounded-md border border-border bg-white/[0.04] p-2.5 border-l-[3px]', statusColor)}>
      <div className="text-[13px] leading-snug">{task.subject}</div>
      {task.description && (
        <div className="mt-1 text-[11px] opacity-50 line-clamp-2">{task.description}</div>
      )}
      {task.owner && (
        <div className="mt-1.5 text-[11px] text-[#6b7280]">{task.owner}</div>
      )}
    </div>
  )
}

function Column({ title, tasks, count }: { title: string; tasks: TaskItem[]; count: number }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-[11px] text-[#6b7280] bg-white/[0.08] rounded-full px-1.5 py-0.5 leading-none">{count}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1">
        {tasks.map(t => <TaskCard key={t.id} task={t} />)}
        {tasks.length === 0 && (
          <div className="text-[12px] text-[#6b7280] text-center py-4 opacity-50">No tasks</div>
        )}
      </div>
    </div>
  )
}

export default function TaskBoardModal({ roomId, tasksInfo, onClose }: TaskBoardModalProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [optimisticTasks, setOptimisticTasks] = useState<TaskItem[]>([])

  const tasks = useMemo(() => {
    const wsTasks = tasksInfo?.tasks ?? []
    const wsIds = new Set(wsTasks.map(t => t.id))
    const remaining = optimisticTasks.filter(t => !wsIds.has(t.id))
    return [...remaining, ...wsTasks]
  }, [tasksInfo, optimisticTasks])

  const pending = tasks.filter(t => t.status === 'pending')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const completed = tasks.filter(t => t.status === 'completed')

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = subject.trim()
    if (!trimmed || submitting) return

    setError('')
    setSubmitting(true)
    try {
      const result = await api.createTask(roomId, trimmed, description.trim() || undefined)
      setOptimisticTasks(prev => [...prev, result.task])
      setSubject('')
      setDescription('')
    } catch {
      setError('Failed to create task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [roomId, subject, description, submitting])

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
          <Column title="Pending" tasks={pending} count={pending.length} />
          <Column title="In Progress" tasks={inProgress} count={inProgress.length} />
          <Column title="Completed" tasks={completed} count={completed.length} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
