import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import CanvasView from '../../components/CanvasView'
import ChatView from '../../components/ChatView'
import MainHeader from '../../components/MainHeader'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { useDeleteRoom, useRenameRoom, useUpdateRoomProject } from '../../hooks/useRoomMutations'
import { useRoomsQuery } from '../../hooks/useRoomsQuery'
import { useTeamInfoQuery } from '../../hooks/useTeamInfoQuery'
import { useChatContext } from '../../lib/chat-context'

export const Route = createFileRoute('/chat/$id')({
  component: ChatRoom,
})

function ChatRoom() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const {
    apiKey,
    userName,
    isStandalone,
    setTeamSidebarOpen,
    showQR,
  } = useChatContext()
  const { data: rooms = [], isLoading: roomsLoading } = useRoomsQuery()
  const { data: projects = [] } = useProjectsQuery()
  const { data: teamInfo } = useTeamInfoQuery(id)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)

  const deleteRoomMutation = useDeleteRoom()
  const renameRoomMutation = useRenameRoom()
  const updateRoomProjectMutation = useUpdateRoomProject()

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? (roomsLoading ? 'Loading...' : 'Room not found')

  useEffect(() => {
    document.title = room ? `Meet AI: ${room.name}` : 'Meet AI'
    return () => {
      document.title = 'Meet AI'
    }
  }, [room])

  const handleDeleteConfirm = useCallback(() => {
    if (!room) return
    deleteRoomMutation.mutate({ param: { id: room.id } }, {
      onSuccess: () => {
        toast.success(`"${room.name}" deleted`)
        navigate({ to: '/chat' })
      },
      onError: () => {
        toast.error('Failed to delete room. Please try again.')
      },
    })
  }, [room, deleteRoomMutation, navigate])

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

  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col">
      <MainHeader
        room={room}
        projects={projects}
        roomName={roomName}
        showInvite={!isStandalone && !!room}
        showTeamToggle={!!teamInfo}
        onTeamToggle={() => setTeamSidebarOpen(prev => !prev)}
        onInviteClick={() => showQR()}
        onRename={handleRename}
        onAttachProject={handleAttachProject}
        onDelete={handleDeleteConfirm}
        onTerminalClick={() => setTerminalOpen(true)}
        onCanvasClick={() => setCanvasOpen(true)}
      />
      {room ? (
        <>
          <ChatView
            key={room.id}
            room={room}
            apiKey={apiKey}
            userName={userName}
            terminalOpen={terminalOpen}
            onTerminalClose={() => setTerminalOpen(false)}
          />
          <CanvasView
            roomId={room.id}
            open={canvasOpen}
            onClose={() => setCanvasOpen(false)}
            userName={userName}
          />
        </>
      ) : !roomsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-[#888]">This room doesn&apos;t exist or has been deleted.</div>
        </div>
      ) : null}
    </div>
  )
}
