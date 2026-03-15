export const queryKeys = {
  rooms: {
    all: ['rooms'] as const,
    byId: (id: string) => ['rooms', id] as const,
    timeline: (id: string) => ['rooms', id, 'timeline'] as const,
    tasks: (id: string) => ['rooms', id, 'tasks'] as const,
    teamInfo: (id: string) => ['rooms', id, 'teamInfo'] as const,
    commands: (id: string) => ['rooms', id, 'commands'] as const,
    attachmentCounts: (id: string) => ['rooms', id, 'attachmentCounts'] as const,
    decisions: (id: string) => ['rooms', id, 'decisions'] as const,
  },
  projects: {
    all: ['projects'] as const,
  },
  tts: {
    status: ['tts', 'status'] as const,
  },
}
