import { useMemo, useState, useCallback } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '../ui/sidebar'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../ui/collapsible'
import SidebarHeaderContent from '../SidebarHeader'
import SearchForm from '../SearchForm'
import SidebarFooterContent from '../SidebarFooter'
import DeleteConfirmPopover from '../DeleteConfirmPopover'
import { IconTrash } from '../../icons'
import { useHaptics } from '../../hooks/useHaptics'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { EllipsisIcon, PlusIcon, MinusIcon } from 'lucide-react'
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

function ProjectActions({ project, onRename }: { project: Project; onRename?: (id: string, name: string) => void }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState(project.name)

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name && onRename) {
      onRename(project.id, trimmed)
    }
    setRenameOpen(false)
  }, [name, project.id, project.name, onRename])

  if (!onRename) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<SidebarMenuAction showOnHover />}
          onClick={e => e.stopPropagation()}
        >
          <EllipsisIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          <DropdownMenuItem onClick={() => { setName(project.name); setRenameOpen(true) }}>
            Rename
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

function RoomSubItem({ room, isActive, onDelete, onLinkClick }: {
  room: Room
  isActive: boolean
  onDelete?: (id: string) => void
  onLinkClick: () => void
}) {
  return (
    <SidebarMenuSubItem className="group/room relative border-b border-sidebar-border last:border-b-0">
      <SidebarMenuSubButton
        isActive={isActive}
        render={<Link to="/chat/$id" params={{ id: room.id }} />}
        onClick={onLinkClick}
      >
        <span className="truncate">{room.name}</span>
      </SidebarMenuSubButton>
      {onDelete && (
        <DeleteConfirmPopover roomName={room.name} onConfirm={() => onDelete(room.id)}>
          <button
            type="button"
            aria-label={`Delete ${room.name}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 cursor-pointer items-center justify-center rounded border-none bg-transparent text-gray-500 opacity-0 transition-opacity duration-100 group-hover/room:opacity-100 group-has-data-popup-open/room:opacity-100 hover:text-red-400 data-[popup-open]:text-red-400"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            <IconTrash size={14} />
          </button>
        </DeleteConfirmPopover>
      )}
    </SidebarMenuSubItem>
  )
}

function RoomMenuItem({ room, isActive, onDelete, onLinkClick }: {
  room: Room
  isActive: boolean
  onDelete?: (id: string) => void
  onLinkClick: () => void
}) {
  return (
    <SidebarMenuItem className="group/room relative border-b border-sidebar-border last:border-b-0">
      <SidebarMenuButton
        className="h-11"
        isActive={isActive}
        render={<Link to="/chat/$id" params={{ id: room.id }} />}
        onClick={onLinkClick}
      >
        <span className="truncate">{room.name}</span>
      </SidebarMenuButton>
      {onDelete && (
        <DeleteConfirmPopover roomName={room.name} onConfirm={() => onDelete(room.id)}>
          <button
            type="button"
            aria-label={`Delete ${room.name}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 cursor-pointer items-center justify-center rounded border-none bg-transparent text-gray-500 opacity-0 transition-opacity duration-100 group-hover/room:opacity-100 group-has-data-popup-open/room:opacity-100 hover:text-red-400 data-[popup-open]:text-red-400"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            <IconTrash size={14} />
          </button>
        </DeleteConfirmPopover>
      )}
    </SidebarMenuItem>
  )
}

export default function Sidebar({ rooms, projects, userName, onNameChange, onSettingsClick, onSpawnClick, onInstallClick, onDeleteRoom, onRenameProject }: SidebarProps) {
  const [search, setSearch] = useState('')
  const { trigger } = useHaptics()
  const { isMobile, setOpenMobile } = useSidebar()
  const params = useParams({ strict: false }) as { id?: string }

  const handleLinkClick = useCallback(() => {
    trigger('light')
    if (isMobile) setOpenMobile(false)
  }, [trigger, isMobile, setOpenMobile])

  const { projectGroups, unassignedRooms } = useMemo(() => {
    const query = search.toLowerCase().trim()
    const filteredRooms = query
      ? rooms.filter(r => r.name.toLowerCase().includes(query))
      : rooms
    const projectIds = new Set(projects.map(p => p.id))
    const grouped = new Map<string, Room[]>()
    const unassigned: Room[] = []
    for (const room of filteredRooms) {
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
  }, [rooms, projects, search])

  return (
    <ShadcnSidebar className="pb-[env(safe-area-inset-bottom,0px)]">
      <ShadcnSidebarHeader className="border-b border-sidebar-border gap-3">
        <div className="flex h-8 items-center justify-between px-2">
          <span className="text-base font-bold">Chats</span>
          <SidebarHeaderContent onSettingsClick={onSettingsClick} onSpawnClick={onSpawnClick} />
        </div>
        <SearchForm value={search} onValueChange={setSearch} />
      </ShadcnSidebarHeader>
      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarMenu>
            {projectGroups.map(({ project, rooms: projectRooms }) => (
              <Collapsible
                key={project.id}
                defaultOpen
                className="group/collapsible"
              >
                <SidebarMenuItem className="border-b border-sidebar-border">
                  <SidebarMenuButton size="lg" render={<CollapsibleTrigger />}>
                    {project.name}
                    <PlusIcon className="ml-auto size-4 group-aria-expanded/menu-button:hidden" />
                    <MinusIcon className="ml-auto hidden size-4 group-aria-expanded/menu-button:block" />
                  </SidebarMenuButton>
                  <ProjectActions project={project} onRename={onRenameProject} />
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {projectRooms.map(room => (
                        <RoomSubItem
                          key={room.id}
                          room={room}
                          isActive={params.id === room.id}
                          onDelete={onDeleteRoom}
                          onLinkClick={handleLinkClick}
                        />
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
            {unassignedRooms.map(room => (
              <RoomMenuItem
                key={room.id}
                room={room}
                isActive={params.id === room.id}
                onDelete={onDeleteRoom}
                onLinkClick={handleLinkClick}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <ShadcnSidebarFooter className="border-t border-sidebar-border p-0">
        <SidebarFooterContent userName={userName} onNameChange={onNameChange} onInstallClick={onInstallClick} />
      </ShadcnSidebarFooter>
    </ShadcnSidebar>
  )
}
