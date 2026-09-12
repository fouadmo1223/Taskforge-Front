import { useMemo } from 'react';
import { formatDistanceToNowStrict, isPast, format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { TaskPriority } from '@flowdesk/types';
import type { UserSummary } from '@flowdesk/types';
import { cn } from '@/lib/cn';
import { Avatar } from './avatar';
import { Tooltip } from './misc';

const PRIORITY_STYLE: Record<TaskPriority, { dot: string; label: string }> = {
  none: { dot: 'bg-text-subtle', label: 'No priority' },
  low: { dot: 'bg-info', label: 'Low' },
  medium: { dot: 'bg-warning', label: 'Medium' },
  high: { dot: 'bg-accent', label: 'High' },
  urgent: { dot: 'bg-danger', label: 'Urgent' },
};

export function PriorityDot({ priority, className }: { priority: TaskPriority; className?: string }): React.ReactElement {
  const s = PRIORITY_STYLE[priority];
  return (
    <Tooltip content={s.label}>
      <span className={cn('inline-block size-2 shrink-0 rounded-full', s.dot, className)} />
    </Tooltip>
  );
}

export function LabelChip({
  name,
  color,
  solid,
}: {
  name: string;
  color: string;
  /** Trello-style filled pill (solid color, white text) instead of the tinted default. */
  solid?: boolean;
}): React.ReactElement {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={solid ? { backgroundColor: color, color: '#fff' } : { backgroundColor: `${color}22`, color }}
    >
      {name}
    </span>
  );
}

export function DueDate({ value }: { value: string }): React.ReactElement {
  const { i18n } = useTranslation();
  const date = new Date(value);
  const overdue = isPast(date) && date.toDateString() !== new Date().toDateString();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        overdue ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-text-muted',
      )}
    >
      {format(date, 'MMM d', { locale: i18n.resolvedLanguage === 'ar' ? arLocale : enUS })}
    </span>
  );
}

export function RelativeTime({ value }: { value: string }): React.ReactElement {
  const { i18n } = useTranslation();
  const text = useMemo(
    () =>
      formatDistanceToNowStrict(new Date(value), {
        addSuffix: true,
        locale: i18n.resolvedLanguage === 'ar' ? arLocale : enUS,
      }),
    [value, i18n.resolvedLanguage],
  );
  return <time dateTime={value} title={new Date(value).toLocaleString()}>{text}</time>;
}

export function AvatarStack({
  userIds,
  byId,
  size = 'xs',
  max = 4,
}: {
  userIds: string[];
  byId: Map<string, UserSummary>;
  size?: 'xs' | 'sm';
  max?: number;
}): React.ReactElement | null {
  if (userIds.length === 0) return null;
  const shown = userIds.slice(0, max);
  const overflow = userIds.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((id) => {
        const u = byId.get(id);
        return (
          <span key={id} className="rounded-full ring-2 ring-surface">
            <Avatar name={u?.name ?? '?'} src={u?.avatar ?? null} size={size} />
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-surface-sunken text-[9px] font-semibold text-text-muted ring-2 ring-surface">
          +{overflow}
        </span>
      )}
    </div>
  );
}
