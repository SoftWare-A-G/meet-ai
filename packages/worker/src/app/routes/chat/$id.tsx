import CanvasView from '@meet-ai/worker/app/components/CanvasView'
import ChatView from '@meet-ai/worker/app/components/ChatView'
import MainHeader from '@meet-ai/worker/app/components/MainHeader'
import { useIsStandalone } from '@meet-ai/worker/app/hooks/useIsStandalone'
import { useLocalStorage } from '@meet-ai/worker/app/hooks/useLocalStorage'
import { useProjectsQuery } from '@meet-ai/worker/app/hooks/useProjectsQuery'
import { useRoomsQuery } from '@meet-ai/worker/app/hooks/useRoomsQuery'
import { useTeamInfoQuery } from '@meet-ai/worker/app/hooks/useTeamInfoQuery'
import { STORAGE_KEYS } from '@meet-ai/worker/app/lib/constants'
import { getOrCreateHandle } from '@meet-ai/worker/app/lib/handle'
import {
  projectsQueryOptions,
  roomsQueryOptions,
  teamInfoQueryOptions,
  timelineQueryOptions,
} from '@meet-ai/worker/app/lib/query-options'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/chat/$id')({
  loader: async ({ params, context: { queryClient } }) => {
    const [rooms, projects] = await Promise.all([
      queryClient.ensureQueryData(roomsQueryOptions),
      queryClient.ensureQueryData(projectsQueryOptions),
    ])
    const room = rooms.find(r => r.id === params.id) ?? null

    await queryClient.ensureQueryData(timelineQueryOptions(params.id))
    if (room) void queryClient.ensureQueryData(teamInfoQueryOptions(params.id))

    return { room, rooms, projects, roomName: room?.name ?? null }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.roomName ? `Meet AI: ${loaderData.roomName}` : 'Meet AI' }],
  }),
  component: ChatRoom,
  pendingComponent: () => (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col items-center justify-center">
      <div className="text-[#888]">Loading chat...</div>
    </div>
  ),
})

function ChatRoom() {
  const { id } = Route.useParams()
  const { apiKey } = Route.useRouteContext()
  const [userName] = useLocalStorage(STORAGE_KEYS.handle, getOrCreateHandle())
  const isStandalone = useIsStandalone()
  const { data: rooms = [], isLoading: roomsLoading } = useRoomsQuery()
  const { data: projects = [] } = useProjectsQuery()
  const { data: teamInfo } = useTeamInfoQuery(id)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? (roomsLoading ? 'Loading...' : 'Room not found')

  // Parent /chat route guarantees apiKey is non-null before rendering children
  if (!apiKey) return null

  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col">
      <MainHeader
        room={room}
        projects={projects}
        roomName={roomName}
        showInvite={!isStandalone && !!room}
        showTeamToggle={!!teamInfo}
        onTerminalClick={() => setTerminalOpen(true)}
        onCanvasClick={() => setCanvasOpen(true)}
      />
      {room ? (
        <>
          <ChatView
            key={id}
            roomId={id}
            apiKey={apiKey}
            userName={userName}
            terminalOpen={terminalOpen}
            onTerminalClose={() => setTerminalOpen(false)}
          />
          <CanvasView
            roomId={id}
            open={canvasOpen}
            onClose={() => setCanvasOpen(false)}
            userName={userName}
          />
        </>
      ) : !roomsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-[#888]">
            This room doesn&apos;t exist or has been deleted.
          </div>
        </div>
      ) : null}
    </div>
  )
}
