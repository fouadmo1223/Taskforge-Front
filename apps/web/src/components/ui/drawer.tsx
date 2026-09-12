import { type ReactNode } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatUi } from '@/features/chat/chat-ui.store';
import { Scrollable } from './scrollable';

/**
 * The chat panel is a hand-rolled overlay, not a Radix Dialog/Popover, so it never
 * joins Radix's shared dismissable-layer stack. Without this, opening chat "on top" of
 * a Drawer doesn't register as a nested layer to Radix — pressing Escape, or clicking
 * the person-card "Message" button inside the drawer, would get treated as dismissing
 * *this* dialog instead of (or in addition to) the chat panel on top of it.
 */
function ignoreWhileChatOpen(event: { preventDefault: () => void }): void {
  if (useChatUi.getState().open) event.preventDefault();
}

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** desktop side; on mobile the drawer always becomes a full-screen surface */
  side?: 'end' | 'start';
  width?: string;
}

/**
 * Side drawer for task details and other deep surfaces. Desktop: slides from the
 * inline-end edge. Mobile (<640px): full-screen sheet. Direction-aware (RTL).
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
  side = 'end',
  width = '30rem',
}: DrawerProps): React.ReactElement {
  const fromEnd = side === 'end';
  // The chat panel is a fixed end-anchored overlay too (26rem wide) — when both are
  // open, shift this drawer out of its way instead of letting them sit on top of
  // each other.
  const chatOpen = useChatUi((s) => s.open);
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]"
              />
            </RDialog.Overlay>
            <RDialog.Content
              asChild
              forceMount
              onEscapeKeyDown={ignoreWhileChatOpen}
              onPointerDownOutside={ignoreWhileChatOpen}
              onInteractOutside={ignoreWhileChatOpen}
            >
              <motion.div
                initial={{ x: fromEnd ? '100%' : '-100%', opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: fromEnd ? '100%' : '-100%', opacity: 0.4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 0.9 }}
                style={{ ['--drawer-w' as string]: width, willChange: 'transform' }}
                className={cn(
                  'fixed inset-y-0 z-50 flex w-full flex-col border-border bg-surface-elevated shadow-lg transition-[inset-inline-end] duration-200',
                  'sm:w-[var(--drawer-w)] sm:max-w-[calc(100vw-3rem)]',
                  fromEnd ? cn('end-0 sm:border-s', chatOpen && 'sm:end-[26rem]') : 'start-0 sm:border-e',
                )}
              >
                <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                  <RDialog.Title className="truncate text-sm font-semibold text-text">{title}</RDialog.Title>
                  <RDialog.Close
                    className="rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-surface-sunken hover:text-text"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </RDialog.Close>
                </div>
                <Scrollable className="flex-1 p-4">{children}</Scrollable>
                {footer && (
                  <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
                )}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
