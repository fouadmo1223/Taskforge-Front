import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useMyAvailability, useUpdateMyAvailability } from './time.api';
import { NumberInput, Skeleton, toast } from '@/components/ui';
import { cn } from '@/lib/cn';

/** ISO weekday order: 1 = Monday … 7 = Sunday. Jan 2024 starts on a Monday. */
const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function MyScheduleCard(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { workspaceId } = useWorkspace();
  const q = useMyAvailability(workspaceId);
  const update = useUpdateMyAvailability(workspaceId);

  const days = useMemo(() => {
    const short = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
    const long = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
    return ISO_DAYS.map((iso) => {
      const d = new Date(Date.UTC(2024, 0, iso)); // Jan 1 2024 = Monday
      // First two letters, minus the Arabic article "ال" and any trailing dot,
      // so days stay distinguishable in every locale.
      const raw = short.format(d).replace(/^ال/, '').replace(/\.$/, '');
      return { iso, label: [...raw].slice(0, 2).join(''), full: long.format(d) };
    });
  }, [i18n.language]);

  if (q.isLoading || !q.data) return <Skeleton className="h-20 w-full" />;
  const a = q.data;

  const toggleDay = (iso: number): void => {
    const set = new Set(a.workingDays);
    set.has(iso) ? set.delete(iso) : set.add(iso);
    update.mutate({ workingDays: [...set].sort() }, { onError: () => toast.error(t('errors.generic')) });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('schedule.title')}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          {t('schedule.hoursPerDay')}
          <div className="w-28">
            <NumberInput
              size="sm"
              min={0}
              max={24}
              step={0.5}
              precision={2}
              aria-label={t('schedule.hoursPerDay')}
              value={a.hoursPerDay}
              onChange={(v) => {
                const n = v ?? 0;
                if (n !== a.hoursPerDay) update.mutate({ hoursPerDay: n });
              }}
            />
          </div>
        </label>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          {t('schedule.workingDays')}
          <div className="flex gap-1">
            {days.map(({ iso, label, full }) => {
              const on = a.workingDays.includes(iso);
              return (
                <button
                  key={iso}
                  onClick={() => toggleDay(iso)}
                  title={full}
                  aria-label={full}
                  aria-pressed={on}
                  className={cn(
                    'h-7 min-w-9 rounded-md px-1.5 text-xs font-medium capitalize',
                    on ? 'bg-primary text-primary-contrast' : 'bg-surface-sunken text-text-subtle',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
