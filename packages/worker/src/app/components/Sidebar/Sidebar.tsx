import { useMemo, useState, useCallback } from 'react'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '../ui/sidebar'
import SidebarHeaderContent from '../SidebarHeader'
import RoomList from '../RoomList'
import SidebarFooterContent from '../SidebarFooter'
import { IconChevronRight } from '../../icons'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { EllipsisIcon } from 'lucide-react'
import type { Project, Room } from '../../lib/types'

type SidebarProps = {
  rooms: Room[]
  projects: Project[]
  userName: string
  onNameChange: (name: string) => void
  onSettingsClick: () => void
  onSpawnClick: () => void
  onInstallClick: () => void
  onDeleteRoom?: (id: string) => void
  onRenameProject?: (id: string, name: string) => void
}

function ProjectHeading({ project, onRename }: { project: Project; onRename?: (id: string, name: string) => void }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState(project.name)

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name && onRename) {
      onRename(project.id, trimmed)
    }
    setRenameOpen(false)
  }, [name, project.id, project.name, onRename])

  return (
    <>
      <span className="truncate text-xs font-semibold text-sidebar-foreground/70">
        {project.name}
      </span>
      {onRename && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-sidebar-accent group-hover/project:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            <EllipsisIcon className="size-3.5 text-sidebar-foreground/70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start">
            <DropdownMenuItem onClick={() => { setName(project.name); setRenameOpen(true) }}>
              Rename
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function Sidebar({ rooms, projects, userName, onNameChange, onSettingsClick, onSpawnClick, onInstallClick, onDeleteRoom, onRenameProject }: SidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }, [])

  const { projectGroups, unassignedRooms } = useMemo(() => {
    const projectIds = new Set(projects.map(p => p.id))
    const grouped = new Map<string, Room[]>()
    const unassigned: Room[] = []
    for (const room of rooms) {
      if (room.project_id && projectIds.has(room.project_id)) {
        const list = grouped.get(room.project_id) || []
        list.push(room)
        grouped.set(room.project_id, list)
      } else {
        unassigned.push(room)
      }
    }
    const groups = projects
      .filter(p => grouped.has(p.id))
      .map(p => ({ project: p, rooms: grouped.get(p.id)! }))
    return { projectGroups: groups, unassignedRooms: unassigned }
  }, [rooms, projects])

  return (
    <ShadcnSidebar className="pb-[env(safe-area-inset-bottom,0px)]">
      <ShadcnSidebarHeader className="h-14 shrink-0 flex-row items-center justify-between border-b border-sidebar-border px-4 py-0">
        <span className="text-base font-bold">Chats</span>
        <SidebarHeaderContent onSettingsClick={onSettingsClick} onSpawnClick={onSpawnClick} />
      </ShadcnSidebarHeader>
      <SidebarContent className="overflow-y-auto">
        {projectGroups.map(({ project, rooms: projectRooms }) => {
          const isCollapsed = collapsedProjects.has(project.id)
          return (
            <SidebarGroup key={project.id} className="p-0">
              <SidebarGroupLabel
                className="group/project flex h-8 cursor-pointer select-none items-center gap-1 px-4 text-xs font-semibold text-sidebar-foreground/70"
                onClick={() => toggleProject(project.id)}
              >
                <IconChevronRight
                  size={12}
                  className={`shrink-0 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                />
                <ProjectHeading project={project} onRename={onRenameProject} />
              </SidebarGroupLabel>
              {!isCollapsed && (
                <SidebarGroupContent>
                  <RoomList rooms={projectRooms} onDeleteRoom={onDeleteRoom} />
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          )
        })}
        {unassignedRooms.length > 0 && (
          <SidebarGroup className="p-0">
            {projectGroups.length > 0 && (
              <SidebarGroupLabel className="flex h-8 items-center px-4 text-xs font-semibold text-sidebar-foreground/70">
                Chats
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <RoomList rooms={unassignedRooms} onDeleteRoom={onDeleteRoom} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <ShadcnSidebarFooter className="border-t border-sidebar-border p-0">
        <SidebarFooterContent userName={userName} onNameChange={onNameChange} onInstallClick={onInstallClick} />
      </ShadcnSidebarFooter>
    </ShadcnSidebar>
  )
}
