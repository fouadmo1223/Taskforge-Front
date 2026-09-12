import * as Popover from '@radix-ui/react-popover';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A compact, curated set — no external emoji dataset to keep the bundle small. */
const EMOJI = [
  '😀', '😂', '😅', '😊', '😍', '😘', '😜', '🤔', '😎', '🙄',
  '😴', '😭', '😡', '🥳', '😇', '🤯', '🤗', '🤝', '👍', '👎',
  '👏', '🙏', '💪', '👀', '🔥', '🎉', '✅', '❌', '⭐', '💡',
  '❤️', '💯', '🚀', '⏰', '📌', '📎', '☕', '🐛', '🙌', '👌',
];

export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }): React.ReactElement {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn('rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text', className)}
          aria-label="Emoji"
        >
          <Smile className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[200] w-64 rounded-xl border border-border bg-surface-elevated p-2 shadow-pop"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI.map((e) => (
              <Popover.Close asChild key={e}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex size-7 items-center justify-center rounded-md text-base hover:bg-surface-sunken"
                >
                  {e}
                </button>
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
