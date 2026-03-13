import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useChatContext } from '../../lib/chat-context'
import { deleteRoom, renameRoom, updateRoomProject } from '../../lib/api'
import MainHeader from '../../components/MainHeader'
import ChatView from '../../components/ChatView'
import CanvasView from '../../components/CanvasView'

export const Route = createFileRoute('/chat/$id')({
  component: ChatRoom,
})

function ChatRoom() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { rooms, projects, removeRoom, updateRoom, apiKey, userName, isStandalone, teamInfo, setTeamSidebarOpen, setTeamInfo, setTasksInfo, setCommandsInfo, showQR } = useChatContext()
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? 'Loading...'

  useEffect(() => {
    document.title = room ? `Meet AI: ${room.name}` : 'Meet AI'
    return () => { document.title = 'Meet AI' }
  }, [room])

  const handleDeleteConfirm = useCallback(async () => {
    if (!room) return
    try {
      await deleteRoom(room.id)
      removeRoom(room.id)
      toast.success(`"${room.name}" deleted`)
      navigate({ to: '/chat' })
    } catch {
      toast.error('Failed to delete room. Please try again.')
    }
  }, [room, removeRoom, navigate])

  const handleRename = useCallback(async (name: string) => {
    if (!room) return
    try {
      await renameRoom(room.id, name)
      updateRoom(room.id, { name })
      toast.success('Room renamed')
    } catch {
      toast.error('Failed to rename room.')
    }
  }, [room, updateRoom])

  const handleAttachProject = useCallback(async (projectId: string | null) => {
    if (!room) return
    try {
      await updateRoomProject(room.id, projectId)
      updateRoom(room.id, { project_id: projectId })
      toast.success(projectId ? 'Room attached to project' : 'Room detached from project')
    } catch {
      toast.error('Failed to update project.')
    }
  }, [room, updateRoom])

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
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
      {room && (
        <>
          <ChatView
            key={room.id}
            room={room}
            apiKey={apiKey}
            userName={userName}
            onTeamInfo={setTeamInfo}
            onTasksInfo={setTasksInfo}
            onCommandsInfo={setCommandsInfo}
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
      )}
    </div>
  )
}
