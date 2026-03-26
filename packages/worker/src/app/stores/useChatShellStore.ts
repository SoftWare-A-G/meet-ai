import { create } from 'zustand'

type ChatShellStore = {
  teamSidebarOpen: boolean
  setTeamSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  qrModalOpen: boolean
  showQR: () => void
  hideQR: () => void
}

export const useChatShellStore = create<ChatShellStore>((set) => ({
  teamSidebarOpen: false,
  setTeamSidebarOpen: (open) =>
    set((state) => ({
      teamSidebarOpen: typeof open === 'function' ? open(state.teamSidebarOpen) : open,
    })),
  qrModalOpen: false,
  showQR: () => set({ qrModalOpen: true }),
  hideQR: () => set({ qrModalOpen: false }),
}))
