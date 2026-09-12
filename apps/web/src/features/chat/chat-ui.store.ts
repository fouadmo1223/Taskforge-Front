import { create } from 'zustand';

/**
 * Split out from chat-panel.tsx so other UI (the task Drawer, dialogs…) can read
 * whether chat is open without importing chat-panel.tsx itself and risking a
 * circular import (chat-panel.tsx pulls from the shared '@/components/ui' barrel).
 */
interface ChatUi {
  open: boolean;
  activeId: string | null;
  setOpen: (open: boolean) => void;
  setActive: (id: string | null) => void;
}
export const useChatUi = create<ChatUi>((set) => ({
  open: false,
  activeId: null,
  setOpen: (open) => set({ open }),
  setActive: (activeId) => set({ activeId }),
}));
