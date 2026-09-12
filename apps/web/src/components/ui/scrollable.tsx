import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ScrollableProps extends HTMLAttributes<HTMLDivElement> {
  /** hide the scrollbar entirely but keep scrolling */
  hidden?: boolean;
  axis?: 'y' | 'x' | 'both';
  /** reserve scrollbar width even when not scrolling — stops sideways layout shift */
  gutter?: boolean;
}

/** Any scrolling surface in the app renders through this so scrollbars stay themed. */
export const Scrollable = forwardRef<HTMLDivElement, ScrollableProps>(
  ({ className, hidden, axis = 'y', gutter, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        hidden ? 'scrollable-none' : 'scrollable',
        gutter && !hidden && 'scroll-stable',
        axis === 'y' && 'overflow-y-auto overflow-x-hidden',
        axis === 'x' && 'overflow-x-auto overflow-y-hidden',
        axis === 'both' && 'overflow-auto',
        className,
      )}
      {...props}
    />
  ),
);
Scrollable.displayName = 'Scrollable';
