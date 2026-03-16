export const queryKeys = {
  rooms: {
    all: ['rooms'] as const,
    byId: (id: string) => ['rooms', id] as const,
    timeline: (id: string) => ['rooms', id, 'timeline'] as const,
    tasks: (id: string) => ['rooms', id, 'tasks'] as const,
    teamInfo: (id: string) => ['rooms', id, 'teamInfo'] as const,
    attachmentCounts: (id: string) => ['rooms', id, 'attachmentCounts'] as const,
  },
  projects: {
    all: ['projects'] as const,
  },
  tts: {
    status: ['tts', 'status'] as const,
  },
}
