import { type ReactNode } from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';
import { CloudAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

// ── Tooltip ─────────────────────────────────────────────────────────────────
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}): React.ReactElement {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[120] rounded-md bg-text px-2 py-1 text-xs text-background shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
          <RTooltip.Arrow className="fill-text" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}

// ── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-sunken text-text-subtle">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── ErrorState ──────────────────────────────────────────────────────────────
// Same layout language as EmptyState (icon tile + title + description) but
// tinted danger so a failed load never reads as merely "nothing here".
export function ErrorState({
  icon,
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        {icon ?? <CloudAlert className="size-5" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-sunken"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-text-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
