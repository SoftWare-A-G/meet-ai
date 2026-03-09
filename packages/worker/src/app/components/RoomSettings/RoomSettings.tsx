import { useState, useCallback, useEffect } from 'react'
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
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '../ui/combobox'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import type { Project, Room } from '../../lib/types'

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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(room.project_id ?? null)

  useEffect(() => {
    setName(room.name)
  }, [room.name])

  useEffect(() => {
    setSelectedProjectId(room.project_id ?? null)
  }, [room.project_id])

  const handleRenameSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== room.name) {
      onRename(trimmed)
    }
    setRenameOpen(false)
  }, [name, room.name, onRename])

  const handleAttachSave = useCallback(() => {
    if (selectedProjectId !== (room.project_id ?? null)) {
      onAttachProject(selectedProjectId)
    }
    setAttachOpen(false)
  }, [selectedProjectId, room.project_id, onAttachProject])

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
        <DropdownMenuContent align="start" sideOffset={8}>
          <DropdownMenuItem onClick={() => { setName(room.name); setRenameOpen(true) }}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setSelectedProjectId(room.project_id ?? null); setAttachOpen(true) }}>
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
          <Combobox<string>
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <ComboboxInput placeholder="Search projects..." showClear={!!selectedProjectId} />
            <ComboboxContent>
              <ComboboxList>
                {projects.map(p => (
                  <ComboboxItem key={p.id} value={p.id}>
                    {p.name}
                  </ComboboxItem>
                ))}
              </ComboboxList>
              <ComboboxEmpty>No projects found</ComboboxEmpty>
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
