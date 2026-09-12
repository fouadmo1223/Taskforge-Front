import { type ReactNode } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatUi } from '@/features/chat/chat-ui.store';
import { Scrollable } from './scrollable';

/** See the identical guard in drawer.tsx: the chat panel isn't a Radix primitive, so
 *  it never joins this dialog's dismissable-layer stack on its own. */
function ignoreWhileChatOpen(event: { preventDefault: () => void }): void {
  if (useChatUi.getState().open) event.preventDefault();
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** hide the default close button */
  hideClose?: boolean;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/** Accessible modal: focus trap, Esc close, scroll lock, aria wiring — all from Radix. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose,
}: DialogProps): React.ReactElement {
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
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              />
            </RDialog.Overlay>
            <RDialog.Content
              asChild
              forceMount
              aria-describedby={description ? undefined : undefined}
              onEscapeKeyDown={ignoreWhileChatOpen}
              onPointerDownOutside={ignoreWhileChatOpen}
              onInteractOutside={ignoreWhileChatOpen}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
                  'rounded-2xl border border-border bg-surface-elevated shadow-lg',
                  SIZES[size],
                )}
              >
                {(title || !hideClose) && (
                  <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
                    <div className="min-w-0">
                      {title && (
                        <RDialog.Title className="text-base font-semibold text-text">{title}</RDialog.Title>
                      )}
                      {description && (
                        <RDialog.Description className="mt-1 text-sm text-text-muted">
                          {description}
                        </RDialog.Description>
                      )}
                    </div>
                    {!hideClose && (
                      <RDialog.Close
                        className="-me-1 -mt-1 rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-surface-sunken hover:text-text"
                        aria-label="Close"
                      >
                        <X className="size-4" />
                      </RDialog.Close>
                    )}
                  </div>
                )}
                <Scrollable className="flex-1 px-5 py-1">{children}</Scrollable>
                {footer && (
                  <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>
                )}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
