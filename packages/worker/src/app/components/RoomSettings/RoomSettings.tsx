import { useNavigate } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useDeleteRoom, useRenameRoom, useUpdateRoomProject } from '../../hooks/useRoomMutations'
import { IconSettings } from '../../icons'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '../ui/combobox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import type { RoomsResponse, ProjectsResponse } from '../../lib/fetchers'

type Room = RoomsResponse[number]
type Project = ProjectsResponse[number]

type ProjectOption = {
  label: string
  value: string
}

interface RoomSettingsProps {
  room: Room
  projects: Project[]
}

export default function RoomSettings({ room, projects }: RoomSettingsProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(room.name)
  const projectOptions: ProjectOption[] = projects.map(p => ({ label: p.name, value: p.id }))
  const currentProject = projectOptions.find(p => p.value === room.project_id) ?? null
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(currentProject)

  const renameRoomMutation = useRenameRoom()
  const handleRename = useCallback(
    (name: string) => {
      if (!room) return
      renameRoomMutation.mutate(
        { param: { id: room.id }, json: { name } },
        {
          onSuccess: () => {
            toast.success('Room renamed')
          },
          onError: () => {
            toast.error('Failed to rename room.')
          },
        }
      )
    },
    [room, renameRoomMutation]
  )

  const handleRenameSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== room.name) {
      handleRename(trimmed)
    }
    setRenameOpen(false)
  }, [name, room.name, handleRename])

  const updateRoomProjectMutation = useUpdateRoomProject()
  const handleAttachProject = useCallback(
    (projectId: string | null) => {
      if (!room) return
      updateRoomProjectMutation.mutate(
        { param: { id: room.id }, json: { project_id: projectId } },
        {
          onSuccess: () => {
            toast.success(projectId ? 'Room attached to project' : 'Room detached from project')
          },
          onError: () => {
            toast.error('Failed to update project.')
          },
        }
      )
    },
    [room, updateRoomProjectMutation]
  )

  const handleAttachSave = useCallback(() => {
    const newId = selectedProject?.value ?? null
    if (newId !== (room.project_id ?? null)) {
      handleAttachProject(newId)
    }
    setAttachOpen(false)
  }, [selectedProject, room.project_id, handleAttachProject])

  const navigate = useNavigate()
  const deleteRoomMutation = useDeleteRoom()
  const handleDeleteConfirm = useCallback(() => {
    if (!room) return
    setDeleteOpen(false)

    deleteRoomMutation.mutate(
      { param: { id: room.id } },
      {
        onSuccess: () => {
          toast.success(`"${room.name}" deleted`)
          navigate({ to: '/chat' })
        },
        onError: () => {
          toast.error('Failed to delete room. Please try again.')
        },
      }
    )
  }, [room, deleteRoomMutation, navigate])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lg hover:bg-white/10"
          aria-label="Room settings">
          <IconSettings size={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="min-w-48">
          <DropdownMenuItem
            onClick={() => {
              setName(room.name)
              setRenameOpen(true)
            }}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setSelectedProject(projectOptions.find(p => p.value === room.project_id) ?? null)
              setAttachOpen(true)
            }}>
            Attach to Project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename room</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSave()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSave} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach to project</DialogTitle>
          </DialogHeader>
          <Combobox<ProjectOption>
            items={projectOptions}
            value={selectedProject}
            onValueChange={setSelectedProject}
            itemToStringValue={option => option.label}>
            <ComboboxInput placeholder="Search projects..." showClear={!!selectedProject} />
            <ComboboxContent>
              {projects.length === 0 ? (
                <ComboboxEmpty className="flex">No projects found</ComboboxEmpty>
              ) : null}
              <ComboboxList>
                {option => (
                  <ComboboxItem key={option.value} value={option}>
                    {option.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAttachSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{room.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all messages and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
