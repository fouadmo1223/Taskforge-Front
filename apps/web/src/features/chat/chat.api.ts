import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloudinaryAsset, CursorPage } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface ConversationView {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  memberUserIds: string[];
  createdByUserId: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageSenderUserId: string | null;
  unreadCount: number;
}

export interface ChatMessageView {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  attachment: CloudinaryAsset | null;
  mentionUserIds: string[];
  edited: boolean;
  forwardedFromUserId: string | null;
  createdAt: string;
}

export const convosKey = (w: string) => ['conversations', w];
const msgsKey = (w: string, c: string) => ['chat-messages', w, c];

export function useConversations(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: convosKey(workspaceId),
    queryFn: () => api.get<ConversationView[]>(`/workspaces/${workspaceId}/conversations`),
    enabled,
    staleTime: 10_000,
  });
}

export function useChatMessages(workspaceId: string, conversationId: string | null) {
  return useQuery({
    queryKey: msgsKey(workspaceId, conversationId ?? ''),
    queryFn: () =>
      api.get<CursorPage<ChatMessageView>>(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  });
}

export function useOpenDirect(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<ConversationView>(`/workspaces/${workspaceId}/conversations/direct`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: convosKey(workspaceId) }),
  });
}

export function useCreateGroup(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; memberUserIds: string[] }) =>
      api.post<ConversationView>(`/workspaces/${workspaceId}/conversations/groups`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: convosKey(workspaceId) }),
  });
}

export function useSendMessage(workspaceId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<ChatMessageView>(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`, { body }),
    onSuccess: (msg) => {
      qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, conversationId), (prev) =>
        prev ? { ...prev, items: [...prev.items.filter((m) => m.id !== msg.id), msg] } : prev,
      );
      void qc.invalidateQueries({ queryKey: convosKey(workspaceId) });
    },
  });
}

export function useSendImageMessage(workspaceId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (caption) fd.append('caption', caption);
      return api.post<ChatMessageView>(`/workspaces/${workspaceId}/conversations/${conversationId}/messages/image`, fd);
    },
    onSuccess: (msg) => {
      qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, conversationId), (prev) =>
        prev ? { ...prev, items: [...prev.items.filter((m) => m.id !== msg.id), msg] } : prev,
      );
      void qc.invalidateQueries({ queryKey: convosKey(workspaceId) });
    },
  });
}

export function useEditMessage(workspaceId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { messageId: string; body: string }) =>
      api.patch<ChatMessageView>(`/workspaces/${workspaceId}/conversations/${conversationId}/messages/${v.messageId}`, {
        body: v.body,
      }),
    onSuccess: (msg) =>
      qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, conversationId), (prev) =>
        prev ? { ...prev, items: prev.items.map((m) => (m.id === msg.id ? msg : m)) } : prev,
      ),
  });
}

export function useDeleteMessage(workspaceId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { messageId: string; scope: 'me' | 'everyone' }) =>
      api.delete(`/workspaces/${workspaceId}/conversations/${conversationId}/messages/${v.messageId}`, {
        query: { scope: v.scope },
      }),
    onSuccess: (_r, v) =>
      qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, conversationId), (prev) =>
        prev ? { ...prev, items: prev.items.filter((m) => m.id !== v.messageId) } : prev,
      ),
  });
}

export function useRenameGroup(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { conversationId: string; name: string }) =>
      api.patch<ConversationView>(`/workspaces/${workspaceId}/conversations/${v.conversationId}`, { name: v.name }),
    onSuccess: (convo) =>
      qc.setQueryData<ConversationView[]>(convosKey(workspaceId), (prev) =>
        prev ? prev.map((c) => (c.id === convo.id ? convo : c)) : prev,
      ),
  });
}

export function useAddMembers(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { conversationId: string; userIds: string[] }) =>
      api.post<ConversationView>(`/workspaces/${workspaceId}/conversations/${v.conversationId}/members`, { userIds: v.userIds }),
    onSuccess: (convo) =>
      qc.setQueryData<ConversationView[]>(convosKey(workspaceId), (prev) =>
        prev ? prev.map((c) => (c.id === convo.id ? convo : c)) : prev,
      ),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { conversationId: string; userId: string }) =>
      api.delete(`/workspaces/${workspaceId}/conversations/${v.conversationId}/members/${v.userId}`),
    onSuccess: (_r, v) =>
      qc.setQueryData<ConversationView[]>(convosKey(workspaceId), (prev) =>
        prev
          ? prev
              .map((c) =>
                c.id === v.conversationId ? { ...c, memberUserIds: c.memberUserIds.filter((id) => id !== v.userId) } : c,
              )
              .filter((c) => c.id !== v.conversationId || c.memberUserIds.length > 0)
          : prev,
      ),
  });
}

export function useForwardMessage(workspaceId: string, conversationId: string) {
  return useMutation({
    mutationFn: (v: { messageId: string; toConversationIds: string[] }) =>
      api.post<ChatMessageView[]>(
        `/workspaces/${workspaceId}/conversations/${conversationId}/messages/${v.messageId}/forward`,
        { toConversationIds: v.toConversationIds },
      ),
  });
}

export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
}

export function useReadReceipts(workspaceId: string, conversationId: string | null) {
  return useQuery({
    queryKey: ['chat-reads', workspaceId, conversationId ?? ''],
    queryFn: () => api.get<ReadReceipt[]>(`/workspaces/${workspaceId}/conversations/${conversationId}/reads`),
    enabled: Boolean(conversationId),
    staleTime: 5_000,
  });
}

export function useMarkRead(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { conversationId: string; messageId?: string }) =>
      api.post(`/workspaces/${workspaceId}/conversations/${v.conversationId}/read`, { messageId: v.messageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: convosKey(workspaceId) }),
  });
}

/** Push a realtime-received message into the cache. */
export function appendChatMessage(
  qc: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  msg: ChatMessageView,
): void {
  qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, msg.conversationId), (prev) =>
    prev && !prev.items.some((m) => m.id === msg.id) ? { ...prev, items: [...prev.items, msg] } : prev,
  );
  void qc.invalidateQueries({ queryKey: convosKey(workspaceId) });
}
/** Push a realtime edit (from another member) into the cache. */
export function updateChatMessage(
  qc: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  msg: ChatMessageView,
): void {
  qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, msg.conversationId), (prev) =>
    prev ? { ...prev, items: prev.items.map((m) => (m.id === msg.id ? msg : m)) } : prev,
  );
}
export function removeChatMessage(
  qc: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  conversationId: string,
  messageId: string,
): void {
  qc.setQueryData<CursorPage<ChatMessageView>>(msgsKey(workspaceId, conversationId), (prev) =>
    prev ? { ...prev, items: prev.items.filter((m) => m.id !== messageId) } : prev,
  );
}
