import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { isToday, isYesterday, format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Crown,
  Forward,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { channels, type CloudinaryAsset } from '@flowdesk/types';
import { errorText } from '@/lib/api/errors';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { useProjects, type ProjectView } from '@/features/projects/projects.api';
import { useAuth } from '@/features/auth/auth.store';
import { realtime } from '@/lib/realtime/ably';
import { useRoom, useRealtimeEvent } from '@/lib/realtime/hooks';
import { cn } from '@/lib/cn';
import { Avatar, Button, Dialog, EmojiPicker, lightbox, MultiSelect, Skeleton, toast } from '@/components/ui';
import { Scrollable } from '@/components/ui/scrollable';
import { RelativeTime } from '@/components/ui/bits';
import {
  appendChatMessage,
  convosKey,
  removeChatMessage,
  updateChatMessage,
  useAddMembers,
  useChatMessages,
  useConversations,
  useCreateGroup,
  useDeleteMessage,
  useEditMessage,
  useForwardMessage,
  useMarkRead,
  useOpenDirect,
  useReadReceipts,
  useRemoveMember,
  useRenameGroup,
  useSearchMessages,
  useSendImageMessage,
  useSendMessage,
  useToggleReaction,
  type ChatMessageView,
  type ConversationView,
  type ReadReceipt,
} from './chat.api';
import { ensureNotificationPermission, isTabActive, notifyNewMessage } from './chat-notifications';
import { useChatUi } from './chat-ui.store';

export { useChatUi } from './chat-ui.store';

/** Matches the backend's own edit / delete-for-everyone cutoff. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** "Today" / "Yesterday" / a localized full date — for the divider between days. */
function dayLabel(dateStr: string, lang: string, t: ReturnType<typeof useTranslation>['t']): string {
  const d = new Date(dateStr);
  if (isToday(d)) return t('chat.today');
  if (isYesterday(d)) return t('chat.yesterday');
  return format(d, 'PPP', { locale: lang === 'ar' ? arLocale : enUS });
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function useTotalUnread(): number {
  const { workspaceId } = useWorkspace();
  const q = useConversations(workspaceId, true);
  return useMemo(() => (q.data ?? []).reduce((s, c) => s + c.unreadCount, 0), [q.data]);
}

export function ChatPanel(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const open = useChatUi((s) => s.open);
  const setOpen = useChatUi((s) => s.setOpen);
  const activeId = useChatUi((s) => s.activeId);
  const setActive = useChatUi((s) => s.setActive);
  const { users, byId } = useWorkspaceUsers(workspaceId);
  const projects = useProjects(workspaceId);
  const myId = useAuth((s) => s.user?.id ?? '');

  const convos = useConversations(workspaceId, open);
  const openDirect = useOpenDirect(workspaceId);
  const createGroup = useCreateGroup(workspaceId);
  const [composing, setComposing] = useState<'none' | 'dm' | 'group'>('none');
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Ask for notification permission once the user is in the app — cheap, and we need it
  // granted before the first message arrives for the "new message in another tab" alert below.
  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    setShowGroupInfo(false);
  }, [activeId]);

  // realtime: conversation membership changes → re-auth token + refresh list
  useRealtimeEvent('chat.conversation_updated', () => {
    realtime.reauth();
    void convos.refetch();
  });
  useRealtimeEvent<{ message: ChatMessageView }>('chat.message', (msg) => {
    const message = msg.payload.message;
    if (!message) return;
    appendChatMessage(qc, workspaceId, message);
    if (message.senderUserId === myId) return;

    // Skip the alert if the user is already looking at this exact conversation.
    const viewingThisConvo = open && activeId === message.conversationId && isTabActive();
    if (viewingThisConvo) return;

    const list = qc.getQueryData<ConversationView[]>(convosKey(workspaceId));
    const convo = list?.find((c) => c.id === message.conversationId);
    const sender = byId.get(message.senderUserId);
    const title =
      convo?.type === 'group' ? (convo.name ?? t('chat.group')) : (sender?.name ?? t('chat.newMessage'));
    const body = message.attachment ? t('chat.imageMessage') : message.body;
    notifyNewMessage({
      title,
      body: body || t('chat.newMessage'),
      tag: `chat-${message.conversationId}`,
      onClick: () => {
        setActive(message.conversationId);
        setOpen(true);
      },
    });
  });
  useRealtimeEvent<{ messageId: string }>('chat.message_deleted', (msg) => {
    const cid = (msg.payload as { conversationId?: string }).conversationId ?? activeId;
    if (cid && msg.payload.messageId) removeChatMessage(qc, workspaceId, cid, msg.payload.messageId);
  });

  const active = convos.data?.find((c) => c.id === activeId) ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="chat-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div
            key="chat-panel"
            initial={{ x: '100%', opacity: 0.4 }}
            animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } }}
            exit={{ x: '100%', opacity: 0.4, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            className="fixed inset-y-0 end-0 z-[85] flex w-full max-w-md flex-col border-s border-border bg-surface-elevated shadow-2xl sm:w-[26rem]"
          >
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              {(active || composing !== 'none') && (
                <button
                  onClick={() => (composing !== 'none' ? setComposing('none') : showGroupInfo ? setShowGroupInfo(false) : setActive(null))}
                  className="rounded-lg p-1 text-text-muted hover:bg-surface-sunken"
                  aria-label={t('common.back')}
                >
                  <ArrowLeft className="size-4 rtl:rotate-180" />
                </button>
              )}
              {composing !== 'none' ? (
                <span className="flex-1 truncate text-sm font-semibold text-text">
                  {composing === 'dm' ? t('chat.newDm') : t('chat.newGroup')}
                </span>
              ) : active && !showGroupInfo ? (
                active.type === 'group' ? (
                  <button
                    onClick={() => setShowGroupInfo(true)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 text-start hover:text-primary"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Users className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{conversationTitle(active, byId, myId, t('chat.dm'))}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-text-subtle rtl:rotate-180" />
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Avatar
                      name={conversationTitle(active, byId, myId, t('chat.dm'))}
                      src={byId.get(active.memberUserIds.find((id) => id !== myId) ?? '')?.avatar ?? null}
                      size="xs"
                    />
                    <span className="truncate text-sm font-semibold text-text">{conversationTitle(active, byId, myId, t('chat.dm'))}</span>
                  </span>
                )
              ) : (
                <span className="flex-1 truncate text-sm font-semibold text-text">
                  {active ? t('chat.groupInfo') : t('chat.title')}
                </span>
              )}
              {!active && composing === 'none' && (
                <>
                  <button onClick={() => setComposing('dm')} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken" title={t('chat.newDm')}>
                    <MessageSquarePlus className="size-4" />
                  </button>
                  <button onClick={() => setComposing('group')} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken" title={t('chat.newGroup')}>
                    <Users className="size-4" />
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
                <X className="size-4" />
              </button>
            </header>

            {composing !== 'none' ? (
              <NewConversation
                mode={composing}
                users={users.filter((u) => u.id !== myId)}
                projects={projects.data ?? []}
                onCancel={() => setComposing('none')}
                busy={openDirect.isPending || createGroup.isPending}
                onSubmit={async (payload) => {
                  try {
                    const convo =
                      payload.mode === 'dm'
                        ? await openDirect.mutateAsync(payload.userId)
                        : await createGroup.mutateAsync({ name: payload.name, memberUserIds: payload.memberUserIds });
                    setComposing('none');
                    setActive(convo.id);
                  } catch {
                    toast.error(t('errors.generic'));
                  }
                }}
              />
            ) : active ? (
              showGroupInfo ? (
                <GroupInfoPanel
                  conversation={active}
                  onLeft={() => {
                    setShowGroupInfo(false);
                    setActive(null);
                  }}
                />
              ) : (
                <ConversationThread conversation={active} />
              )
            ) : (
              <ConversationList
                conversations={convos.data ?? []}
                loading={convos.isLoading}
                byId={byId}
                myId={myId}
                dmLabel={t('chat.dm')}
                emptyLabel={t('chat.empty')}
                onOpen={setActive}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function conversationTitle(
  c: ConversationView,
  byId: Map<string, { name: string }>,
  myId: string,
  dmLabel: string,
): string {
  if (c.type === 'group') return c.name ?? dmLabel;
  const other = c.memberUserIds.find((id) => id !== myId);
  return byId.get(other ?? '')?.name ?? dmLabel;
}

function ConversationList({
  conversations,
  loading,
  byId,
  myId,
  dmLabel,
  emptyLabel,
  onOpen,
}: {
  conversations: ConversationView[];
  loading: boolean;
  byId: Map<string, { name: string; avatar?: CloudinaryAsset | string | null }>;
  myId: string;
  dmLabel: string;
  emptyLabel: string;
  onOpen: (id: string) => void;
}): React.ReactElement {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-text-subtle">
          <MessageSquarePlus className="size-5" />
        </span>
        <p className="text-sm text-text-subtle">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <Scrollable className="flex-1 p-1.5">
      {conversations.map((c) => {
        const title = conversationTitle(c, byId, myId, dmLabel);
        const unread = c.unreadCount > 0;
        const other = c.type === 'direct' ? c.memberUserIds.find((id) => id !== myId) : undefined;
        return (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start hover:bg-surface-sunken"
          >
            {c.type === 'group' ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Users className="size-4" />
              </span>
            ) : (
              <Avatar name={title} src={byId.get(other ?? '')?.avatar ?? null} size="md" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className={cn('truncate text-sm', unread ? 'font-semibold text-text' : 'font-medium text-text')}>{title}</span>
                <span className={cn('shrink-0 text-[11px]', unread ? 'font-medium text-primary' : 'text-text-subtle')}>
                  <RelativeTime value={c.lastMessageAt} />
                </span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className={cn('truncate text-xs', unread ? 'text-text' : 'text-text-muted')}>{c.lastMessagePreview || '—'}</span>
                {unread && (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-contrast">{c.unreadCount}</span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </Scrollable>
  );
}

function ConversationThread({ conversation }: { conversation: ConversationView }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { workspaceId } = useWorkspace();
  const { byId } = useWorkspaceUsers(workspaceId);
  const myId = useAuth((s) => s.user?.id ?? '');
  const qc = useQueryClient();
  const open = useChatUi((s) => s.open);
  const messages = useChatMessages(workspaceId, conversation.id);
  const reads = useReadReceipts(workspaceId, conversation.id);
  const send = useSendMessage(workspaceId, conversation.id);
  const sendImage = useSendImageMessage(workspaceId, conversation.id);
  const editMsg = useEditMessage(workspaceId, conversation.id);
  const del = useDeleteMessage(workspaceId, conversation.id);
  const forwardMsg = useForwardMessage(workspaceId, conversation.id);
  const react = useToggleReaction(workspaceId, conversation.id);
  const conversations = useConversations(workspaceId);
  const markRead = useMarkRead(workspaceId);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessageView | null>(null);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSentRef = useRef(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const searchResults = useSearchMessages(workspaceId, conversation.id, searchQuery);
  const messageElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [flashId, setFlashId] = useState<string | null>(null);
  const closeSearch = (): void => {
    setSearchOpen(false);
    setSearchInput('');
    setSearchQuery('');
  };
  const jumpToMessage = (messageId: string): void => {
    const el = messageElsRef.current.get(messageId);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFlashId(messageId);
      setTimeout(() => setFlashId((cur) => (cur === messageId ? null : cur)), 1600);
    }
    closeSearch();
  };

  useRoom(channels.conversation(conversation.id));
  useRealtimeEvent<{ userId: string; messageId: string | null; at: string }>('chat.read', (msg) => {
    const { userId, messageId, at } = msg.payload;
    qc.setQueryData<ReadReceipt[]>(['chat-reads', workspaceId, conversation.id], (prev) => {
      const rest = (prev ?? []).filter((r) => r.userId !== userId);
      return [...rest, { userId, lastReadMessageId: messageId, lastReadAt: at }];
    });
  });
  useRealtimeEvent<{ message: ChatMessageView }>('chat.message_updated', (msg) => {
    if (msg.payload.message) updateChatMessage(qc, workspaceId, msg.payload.message);
  });
  useRealtimeEvent('chat.typing', (msg) => {
    const uid = msg.actorId;
    if (!uid || uid === myId) return;
    setTypingUserIds((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    const timers = typingTimersRef.current;
    clearTimeout(timers.get(uid));
    timers.set(
      uid,
      setTimeout(() => {
        setTypingUserIds((prev) => prev.filter((id) => id !== uid));
        timers.delete(uid);
      }, 4000),
    );
  });
  useEffect(() => {
    const timers = typingTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);
  // a different conversation was opened — its typers don't apply here
  useEffect(() => {
    setTypingUserIds([]);
  }, [conversation.id]);

  const notifyTyping = (): void => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    realtime.publish(channels.conversation(conversation.id), 'chat.typing', { conversationId: conversation.id });
  };

  const items = messages.data?.items ?? [];
  const others = conversation.memberUserIds.filter((id) => id !== myId);
  const typingNames = typingUserIds.map((uid) => byId.get(uid)?.name).filter((n): n is string => Boolean(n));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const last = items.at(-1);
    // Only mark as read while the panel is genuinely open and the browser
    // tab is focused. AnimatePresence keeps this component mounted for its
    // ~220ms close animation after the panel is dismissed (e.g. clicking
    // the backdrop) — a message arriving in that window was previously
    // still getting marked read, even though the user had already closed
    // the panel and never actually saw it. `open` is read live from the
    // store (not inferred from still being mounted), so it reflects the
    // real current state immediately, mid-exit-animation included.
    if (last && open && isTabActive()) markRead.mutate({ conversationId: conversation.id, messageId: last.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, conversation.id, open]);

  // A message that arrived while the tab was hidden/unfocused is correctly
  // left unread by the effect above — but nothing retried it once the user
  // actually came back, until the next new message happened to arrive.
  // Retry on regaining visibility/focus instead of waiting for that.
  useEffect(() => {
    const tryMarkRead = (): void => {
      if (!open || !isTabActive()) return;
      const last = items.at(-1);
      if (last) markRead.mutate({ conversationId: conversation.id, messageId: last.id });
    };
    document.addEventListener('visibilitychange', tryMarkRead);
    window.addEventListener('focus', tryMarkRead);
    return () => {
      document.removeEventListener('visibilitychange', tryMarkRead);
      window.removeEventListener('focus', tryMarkRead);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, conversation.id, open]);

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (!body) return;
    if (editingId) {
      const id = editingId;
      setEditingId(null);
      setDraft('');
      await editMsg.mutateAsync({ messageId: id, body }).catch((e) => toast.error(errorText(e, t)));
      return;
    }
    setDraft('');
    await send.mutateAsync(body).catch(() => {
      setDraft(body);
      toast.error(t('errors.generic'));
    });
  };

  const startEdit = (m: ChatMessageView): void => {
    setEditingId(m.id);
    setDraft(m.body);
    textareaRef.current?.focus();
  };

  /** who (besides the sender) has read up to at least this message's time */
  const readBy = (m: ChatMessageView): string[] =>
    others.filter((uid) => {
      const r = reads.data?.find((x) => x.userId === uid);
      return r && new Date(r.lastReadAt).getTime() >= new Date(m.createdAt).getTime();
    });

  return (
    <>
      <div className="relative border-b border-border">
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          {searchOpen ? (
            <>
              <Search className="size-3.5 shrink-0 text-text-subtle" />
              <input
                autoFocus
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                placeholder={t('chat.searchPlaceholder')}
                className="h-7 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
              />
              <button onClick={closeSearch} className="shrink-0 rounded p-1 text-text-subtle hover:bg-surface-sunken hover:text-text">
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-text-subtle hover:bg-surface-sunken hover:text-text"
            >
              <Search className="size-3.5" />
              {t('chat.search')}
            </button>
          )}
        </div>
        {searchOpen && searchQuery && (
          <div className="absolute inset-x-0 top-full z-10 max-h-72 overflow-y-auto border-b border-border bg-surface-elevated shadow-pop">
            {searchResults.isLoading ? (
              <div className="p-3 text-center text-xs text-text-subtle">{t('common.loading')}</div>
            ) : (searchResults.data ?? []).length === 0 ? (
              <div className="p-3 text-center text-xs text-text-subtle">{t('chat.noSearchResults')}</div>
            ) : (
              (searchResults.data ?? []).map((m) => (
                <button
                  key={m.id}
                  onClick={() => jumpToMessage(m.id)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-border/50 px-3 py-2 text-start last:border-0 hover:bg-surface-sunken"
                >
                  <span className="flex w-full items-center justify-between gap-2 text-[11px] text-text-subtle">
                    <span className="font-medium text-text">{byId.get(m.senderUserId)?.name ?? '—'}</span>
                    <RelativeTime value={m.createdAt} />
                  </span>
                  <span className="line-clamp-2 text-xs text-text-muted">{m.body || t('chat.imageMessage')}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <Scrollable className="flex-1 px-4 py-3">
        {messages.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-2/3" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((m, i) => {
              const mine = m.senderUserId === myId;
              const isGroupOther = conversation.type === 'group' && !mine;
              const startOfRun = items[i - 1]?.senderUserId !== m.senderUserId;
              const showName = isGroupOther && startOfRun;
              const showDayDivider = i === 0 || !sameDay(items[i - 1]!.createdAt, m.createdAt);
              const editable = mine && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
              const seenByOthers = mine ? readBy(m) : [];
              const seenByAll = mine && others.length > 0 && seenByOthers.length === others.length;
              return (
                <div key={m.id} className="flex flex-col">
                  {showDayDivider && (
                    <div className="my-2 flex items-center gap-2 text-[11px] font-medium text-text-subtle">
                      <div className="h-px flex-1 bg-border" />
                      <span>{dayLabel(m.createdAt, i18n.resolvedLanguage ?? 'en', t)}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    ref={(el) => {
                      if (el) messageElsRef.current.set(m.id, el);
                      else messageElsRef.current.delete(m.id);
                    }}
                    className={cn(
                      'group flex flex-col rounded-xl transition-colors',
                      mine ? 'items-end' : 'items-start',
                      flashId === m.id && 'bg-primary-soft',
                    )}
                  >
                  {showName && <span className="mb-0.5 ms-8 text-[11px] font-medium text-text-subtle">{byId.get(m.senderUserId)?.name ?? '—'}</span>}
                  <div className={cn('flex items-end gap-1.5', mine && 'flex-row-reverse')}>
                    {isGroupOther &&
                      (startOfRun ? (
                        <Avatar
                          name={byId.get(m.senderUserId)?.name ?? '?'}
                          src={byId.get(m.senderUserId)?.avatar ?? null}
                          size="xs"
                          className="mb-0.5 self-end"
                        />
                      ) : (
                        <span className="size-5 shrink-0" aria-hidden />
                      ))}
                    <div
                      className={cn(
                        'max-w-[78%] whitespace-pre-wrap break-words rounded-2xl text-sm',
                        m.attachment ? 'overflow-hidden p-1' : 'px-3 py-2',
                        mine ? 'bg-primary text-primary-contrast' : 'bg-surface-sunken text-text',
                      )}
                    >
                      {m.forwardedFromUserId && (
                        <div className={cn('flex items-center gap-1 text-[10px] opacity-70', m.attachment && 'px-2 pt-1.5')}>
                          <Forward className="size-2.5" />
                          {t('chat.forwarded')}
                        </div>
                      )}
                      {m.attachment && (
                        <button onClick={() => lightbox.open(m.attachment!.secureUrl)} className="block cursor-zoom-in">
                          <img src={m.attachment.secureUrl} alt="" className="max-h-64 rounded-xl object-cover" />
                        </button>
                      )}
                      {m.body && <div className={cn(m.attachment && 'px-2 pb-1 pt-1.5')}>{m.body}</div>}
                      {m.edited && <span className="ms-1.5 text-[10px] opacity-70">({t('task.edited')})</span>}
                    </div>

                    <Dropdown.Root>
                      <Dropdown.Trigger className="mb-1 rounded p-1 text-text-subtle opacity-0 hover:bg-surface-sunken hover:text-text group-hover:opacity-100">
                        <MoreHorizontal className="size-3.5" />
                      </Dropdown.Trigger>
                      <Dropdown.Portal>
                        <Dropdown.Content
                          align={mine ? 'end' : 'start'}
                          sideOffset={4}
                          className="z-[200] w-44 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop"
                        >
                          {editable && (
                            <Dropdown.Item
                              onSelect={() => startEdit(m)}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                            >
                              <Pencil className="size-3.5 text-text-subtle" />
                              {t('common.edit')}
                            </Dropdown.Item>
                          )}
                          <Dropdown.Item
                            onSelect={() => {
                              setForwarding(m);
                              setForwardTargets([]);
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                          >
                            <Forward className="size-3.5 text-text-subtle" />
                            {t('chat.forward')}
                          </Dropdown.Item>
                          <div className="my-1 border-t border-border" />
                          <Dropdown.Item
                            onSelect={() => del.mutate({ messageId: m.id, scope: 'me' })}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                          >
                            <Trash2 className="size-3.5" />
                            {t('chat.deleteForMe')}
                          </Dropdown.Item>
                          {editable && (
                            <Dropdown.Item
                              onSelect={() => del.mutate({ messageId: m.id, scope: 'everyone' }, { onError: (e) => toast.error(errorText(e, t)) })}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                            >
                              <Trash2 className="size-3.5" />
                              {t('chat.deleteForEveryone')}
                            </Dropdown.Item>
                          )}
                        </Dropdown.Content>
                      </Dropdown.Portal>
                    </Dropdown.Root>

                    <EmojiPicker
                      onPick={(emoji) => react.mutate({ messageId: m.id, emoji })}
                      className="mb-1 rounded p-1 text-text-subtle opacity-0 hover:bg-surface-sunken hover:text-text group-hover:opacity-100"
                    />
                  </div>

                  {m.reactions.length > 0 && (
                    <div className={cn('mt-0.5 flex flex-wrap gap-1', mine && 'justify-end')}>
                      {m.reactions.map((r) => {
                        const mineReacted = r.userIds.includes(myId);
                        return (
                          <button
                            key={r.emoji}
                            onClick={() => react.mutate({ messageId: m.id, emoji: r.emoji })}
                            title={r.userIds.map((uid) => byId.get(uid)?.name ?? '—').join(', ')}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors',
                              mineReacted
                                ? 'border-primary bg-primary-soft text-primary'
                                : 'border-border bg-surface-sunken text-text-muted hover:border-border-strong',
                            )}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-medium">{r.userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-subtle">
                    <RelativeTime value={m.createdAt} />
                    {mine &&
                      (conversation.type === 'group' ? (
                        others.length > 0 && (
                          <Popover.Root>
                            <Popover.Trigger className="flex items-center gap-0.5 hover:text-text">
                              {seenByAll ? <CheckCheck className="size-3 text-primary" /> : <Check className="size-3" />}
                              {seenByOthers.length > 0 && <span>{seenByOthers.length}</span>}
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                side="top"
                                sideOffset={6}
                                className="z-[200] w-52 rounded-xl border border-border bg-surface-elevated p-2 shadow-pop"
                              >
                                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                                  {t('chat.seenBy')}
                                </p>
                                <div className="flex flex-col gap-1">
                                  {others.map((uid) => {
                                    const seen = seenByOthers.includes(uid);
                                    return (
                                      <div key={uid} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                                        <Avatar name={byId.get(uid)?.name ?? '?'} src={byId.get(uid)?.avatar ?? null} size="xs" />
                                        <span className="min-w-0 flex-1 truncate text-text">{byId.get(uid)?.name ?? '—'}</span>
                                        {seen ? <CheckCheck className="size-3 text-primary" /> : <Check className="size-3 text-text-subtle" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        )
                      ) : seenByAll ? (
                        <CheckCheck className="size-3 text-primary" />
                      ) : (
                        <Check className="size-3" />
                      ))}
                  </div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && <p className="py-10 text-center text-sm text-text-subtle">{t('chat.startConversation')}</p>}
            <div ref={bottomRef} />
          </div>
        )}
      </Scrollable>

      {typingNames.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-xs text-text-subtle">
          <span className="flex items-center gap-0.5">
            <span className="size-1 animate-bounce rounded-full bg-text-subtle" style={{ animationDelay: '0ms' }} />
            <span className="size-1 animate-bounce rounded-full bg-text-subtle" style={{ animationDelay: '150ms' }} />
            <span className="size-1 animate-bounce rounded-full bg-text-subtle" style={{ animationDelay: '300ms' }} />
          </span>
          {typingNames.length === 1
            ? t('chat.isTyping', { name: typingNames[0] })
            : t('chat.areTyping', { names: typingNames.join(', ') })}
        </div>
      )}

      {editingId && (
        <div className="flex items-center justify-between border-t border-border bg-surface-sunken/50 px-3 py-1.5 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Pencil className="size-3" />
            {t('chat.editingMessage')}
          </span>
          <button
            onClick={() => {
              setEditingId(null);
              setDraft('');
            }}
            className="rounded p-0.5 hover:bg-surface-sunken hover:text-text"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <form
        className={cn('flex items-end gap-1.5 p-3', !editingId && 'border-t border-border')}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) sendImage.mutate({ file }, { onError: () => toast.error(t('errors.generic')) });
          }}
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={sendImage.isPending || Boolean(editingId)}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text disabled:opacity-50"
          aria-label={t('chat.sendImage')}
        >
          {sendImage.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </button>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!editingId && e.target.value.trim()) notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape' && editingId) {
              setEditingId(null);
              setDraft('');
            }
          }}
          rows={1}
          placeholder={t('chat.messagePlaceholder')}
          className="scrollable max-h-28 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <EmojiPicker
          onPick={(emoji) => {
            setDraft((d) => d + emoji);
            textareaRef.current?.focus();
          }}
        />
        <Button size="icon" type="submit" disabled={!draft.trim()} loading={send.isPending || editMsg.isPending}>
          <Send className="size-4" />
        </Button>
      </form>

      <Dialog
        open={Boolean(forwarding)}
        onOpenChange={(o) => !o && setForwarding(null)}
        title={t('chat.forward')}
        footer={
          <Button
            loading={forwardMsg.isPending}
            onClick={() => {
              if (!forwarding || forwardTargets.length === 0) return;
              forwardMsg.mutate(
                { messageId: forwarding.id, toConversationIds: forwardTargets },
                {
                  onSuccess: () => {
                    toast.success(t('chat.forwarded'));
                    setForwarding(null);
                    setForwardTargets([]);
                  },
                  onError: (e) => toast.error(errorText(e, t)),
                },
              );
            }}
            disabled={forwardTargets.length === 0}
          >
            {t('chat.forward')}
          </Button>
        }
      >
        <MultiSelect
          value={forwardTargets}
          onChange={setForwardTargets}
          options={(conversations.data ?? [])
            .filter((c) => c.id !== conversation.id)
            .map((c) => ({
              value: c.id,
              label: c.type === 'group' ? (c.name ?? t('chat.dm')) : (byId.get(c.memberUserIds.find((id) => id !== myId) ?? '')?.name ?? t('chat.dm')),
            }))}
          placeholder={t('chat.pickConversations')}
        />
      </Dialog>
    </>
  );
}

function GroupInfoPanel({
  conversation,
  onLeft,
}: {
  conversation: ConversationView;
  onLeft: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const { users, byId } = useWorkspaceUsers(workspaceId);
  const myId = useAuth((s) => s.user?.id ?? '');
  const rename = useRenameGroup(workspaceId);
  const addMembers = useAddMembers(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.name ?? '');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    setName(conversation.name ?? '');
  }, [conversation.name]);

  const isCreator = conversation.createdByUserId === myId;
  const addableUsers = users.filter((u) => u.id !== myId && !conversation.memberUserIds.includes(u.id));

  const saveName = (): void => {
    const trimmed = name.trim();
    setEditingName(false);
    if (!trimmed || trimmed === conversation.name) {
      setName(conversation.name ?? '');
      return;
    }
    rename.mutate({ conversationId: conversation.id, name: trimmed }, { onError: (e) => toast.error(errorText(e, t)) });
  };

  return (
    <Scrollable className="flex-1">
      <div className="flex flex-col items-center gap-2 border-b border-border px-4 py-6">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Users className="size-7" />
        </span>
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveName(); }
              if (e.key === 'Escape') { setName(conversation.name ?? ''); setEditingName(false); }
            }}
            maxLength={80}
            className="h-8 w-full max-w-[220px] rounded-lg border border-border bg-surface px-2.5 text-center text-sm font-semibold outline-none focus:border-primary"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="group flex items-center gap-1.5 rounded-lg px-2 py-0.5 hover:bg-surface-sunken">
            <span className="max-w-[220px] truncate text-base font-semibold text-text">{conversation.name}</span>
            <Pencil className="size-3.5 text-text-subtle opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <span className="text-xs text-text-subtle">{t('chat.memberCount', { count: conversation.memberUserIds.length })}</span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{t('chat.members')}</h4>
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
          >
            <UserPlus className="size-3.5" />
            {t('chat.addMembers')}
          </button>
        </div>

        {adding && (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken/50 p-2.5">
            {addableUsers.length === 0 ? (
              <p className="px-1 py-1 text-xs text-text-subtle">{t('chat.everyoneAlreadyIn')}</p>
            ) : (
              <MultiSelect
                value={picked}
                onChange={setPicked}
                options={addableUsers.map((u) => ({ value: u.id, label: u.name, description: u.email }))}
                placeholder={t('chat.pickPeople')}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={picked.length === 0}
                loading={addMembers.isPending}
                onClick={() =>
                  addMembers.mutate(
                    { conversationId: conversation.id, userIds: picked },
                    {
                      onSuccess: () => {
                        setPicked([]);
                        setAdding(false);
                      },
                      onError: (e) => toast.error(errorText(e, t)),
                    },
                  )
                }
              >
                {t('common.add')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setPicked([]); }}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {conversation.memberUserIds.map((uid) => {
            const u = byId.get(uid);
            const creator = conversation.createdByUserId === uid;
            const me = uid === myId;
            const canRemove = !me && isCreator;
            return (
              <div key={uid} className="group flex items-center gap-2.5 rounded-xl px-1.5 py-2 hover:bg-surface-sunken">
                <Avatar name={u?.name ?? '?'} src={u?.avatar ?? null} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-text">{u?.name ?? '—'}</span>
                    {creator && <Crown className="size-3 shrink-0 text-warning" aria-label={t('chat.creator')} />}
                    {me && <span className="shrink-0 text-[11px] text-text-subtle">({t('chat.you')})</span>}
                  </span>
                  {u?.email && <span className="block truncate text-xs text-text-subtle">{u.email}</span>}
                </span>
                {canRemove && (
                  <button
                    onClick={() =>
                      removeMember.mutate(
                        { conversationId: conversation.id, userId: uid },
                        { onError: (e) => toast.error(errorText(e, t)) },
                      )
                    }
                    className="shrink-0 rounded-lg p-1.5 text-text-subtle opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                    aria-label={t('chat.removeMember')}
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <button
          onClick={() =>
            removeMember.mutate(
              { conversationId: conversation.id, userId: myId },
              { onSuccess: onLeft, onError: (e) => toast.error(errorText(e, t)) },
            )
          }
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
        >
          <LogOut className="size-4" />
          {t('chat.leaveGroup')}
        </button>
      </div>
    </Scrollable>
  );
}

type NewPayload = { mode: 'dm'; userId: string } | { mode: 'group'; name: string; memberUserIds: string[] };

function NewConversation({
  mode,
  users,
  projects,
  onSubmit,
  onCancel,
  busy,
}: {
  mode: 'dm' | 'group';
  users: Array<{ id: string; name: string; email: string }>;
  projects: ProjectView[];
  onSubmit: (p: NewPayload) => void;
  onCancel: () => void;
  busy: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const options = users.map((u) => {
    const shared = projects.filter((p) => p.memberUserIds.includes(u.id) || p.leadUserId === u.id).length;
    return {
      value: u.id,
      label: u.name,
      description: shared > 1 ? `${u.email} · ${t('chat.sharedProjects', { count: shared })}` : u.email,
    };
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-text">{mode === 'dm' ? t('chat.newDm') : t('chat.newGroup')}</h3>
      {mode === 'group' && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('chat.groupName')}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
        />
      )}
      <MultiSelect
        value={selected}
        onChange={mode === 'dm' ? (v) => setSelected(v.slice(-1)) : setSelected}
        options={options}
        placeholder={mode === 'dm' ? t('chat.pickPerson') : t('chat.pickPeople')}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={busy}
          disabled={selected.length === 0 || (mode === 'group' && !name.trim())}
          onClick={() =>
            onSubmit(
              mode === 'dm'
                ? { mode: 'dm', userId: selected[0]! }
                : { mode: 'group', name: name.trim(), memberUserIds: selected },
            )
          }
        >
          {mode === 'dm' ? t('chat.startChat') : t('common.create')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
