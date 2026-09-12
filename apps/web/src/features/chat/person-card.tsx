import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import type { UserSummary } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import { useOpenDirect } from './chat.api';
import { useChatUi } from './chat-panel';
import { Avatar, Button } from '@/components/ui';

/**
 * Wraps any trigger (an avatar, a name) in a popover showing the person's
 * details and a "Message" button that jumps straight into a DM with them.
 */
export function PersonCard({ user, trigger }: { user: UserSummary; trigger: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const myId = useAuth((s) => s.user?.id);
  const openDirect = useOpenDirect(workspaceId);
  const setChatOpen = useChatUi((s) => s.setOpen);
  const setActive = useChatUi((s) => s.setActive);
  const isMe = user.id === myId;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[200] w-64 rounded-xl border border-border bg-surface-elevated p-3 shadow-pop"
          // Closing this popover (Escape, or clicking outside it) must never bubble up
          // and also dismiss whatever it's opened on top of (a task drawer, a dialog…).
          // Radix normally coordinates that on its own, but this stops it explicitly so
          // it can't regress if this card ever ends up nested a level deeper.
          onEscapeKeyDown={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} src={user.avatar} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{user.name}</p>
              <p className="truncate text-xs text-text-subtle">{user.email}</p>
            </div>
          </div>
          {!isMe && (
            <Popover.Close asChild>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                loading={openDirect.isPending}
                onClick={async () => {
                  const convo = await openDirect.mutateAsync(user.id).catch(() => null);
                  if (convo) {
                    setActive(convo.id);
                    setChatOpen(true);
                  }
                }}
              >
                <MessageCircle className="size-3.5" />
                {t('chat.message')}
              </Button>
            </Popover.Close>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
