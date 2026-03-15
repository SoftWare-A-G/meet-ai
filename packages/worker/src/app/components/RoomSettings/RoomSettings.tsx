import { useState, useCallback } from 'react'
import { IconSettings } from '../../icons'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'
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
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '../ui/combobox'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
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
  onRename: (name: string) => void
  onAttachProject: (projectId: string | null) => void
  onDelete: () => void
}

export default function RoomSettings({ room, projects, onRename, onAttachProject, onDelete }: RoomSettingsProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(room.name)
  const projectOptions: ProjectOption[] = projects.map(p => ({ label: p.name, value: p.id }))
  const currentProject = projectOptions.find(p => p.value === room.project_id) ?? null
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(currentProject)

  const handleRenameSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== room.name) {
      onRename(trimmed)
    }
    setRenameOpen(false)
  }, [name, room.name, onRename])

  const handleAttachSave = useCallback(() => {
    const newId = selectedProject?.value ?? null
    if (newId !== (room.project_id ?? null)) {
      onAttachProject(newId)
    }
    setAttachOpen(false)
  }, [selectedProject, room.project_id, onAttachProject])

  const handleDeleteConfirm = useCallback(() => {
    setDeleteOpen(false)
    onDelete()
  }, [onDelete])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lg hover:bg-white/10"
          aria-label="Room settings"
        >
          <IconSettings size={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="min-w-48">
          <DropdownMenuItem onClick={() => { setName(room.name); setRenameOpen(true) }}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setSelectedProject(projectOptions.find(p => p.value === room.project_id) ?? null); setAttachOpen(true) }}>
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
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSave() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameSave} disabled={!name.trim()}>Save</Button>
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
            itemToStringValue={(option) => option.label}
          >
            <ComboboxInput placeholder="Search projects..." showClear={!!selectedProject} />
            <ComboboxContent>
              {projects.length === 0 ? (
                <ComboboxEmpty className="flex">No projects found</ComboboxEmpty>
              ) : null}
              <ComboboxList>
                {(option) => (
                  <ComboboxItem key={option.value} value={option}>
                    {option.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancel</Button>
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
