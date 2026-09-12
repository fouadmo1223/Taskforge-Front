import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useCalendar } from './planning.api';
import { Scrollable } from '@/components/ui/scrollable';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

export function CalendarView({ projectId, onOpenTask }: { projectId: string; onOpenTask: (id: string) => void }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const q = useCalendar(workspaceId, projectId, gridStart.toISOString(), gridEnd.toISOString());

  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Array<{ id: string; key: string; title: string; completedAt: string | null }>>();
    for (const tk of q.data?.tasks ?? []) {
      const key = format(new Date(tk.dueDate), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tk);
    }
    return map;
  }, [q.data?.tasks]);
  const msByDay = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    for (const m of q.data?.milestones ?? []) {
      const key = format(new Date(m.date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ id: m.id, name: m.name });
    }
    return map;
  }, [q.data?.milestones]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <button onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-32 text-sm font-semibold text-text">{format(month, 'MMMM yyyy')}</span>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
          <ChevronRight className="size-4" />
        </button>
        <button onClick={() => setMonth(startOfMonth(new Date()))} className="ms-2 rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-sunken">
          {t('calendar.today')}
        </button>
      </div>

      {q.isLoading ? (
        <div className="p-4">
          <Skeleton className="h-full min-h-72 w-full" />
        </div>
      ) : (
        <Scrollable className="flex-1 p-3">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="bg-surface px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDay.get(key) ?? [];
              const dayMs = msByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-24 bg-surface p-1.5',
                    !isSameMonth(day, month) && 'bg-surface-sunken/40',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs',
                        isSameDay(day, new Date()) ? 'flex size-5 items-center justify-center rounded-full bg-primary text-primary-contrast' : 'text-text-muted',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayMs.map((m) => (
                      <span key={m.id} className="flex items-center gap-1 truncate rounded bg-accent/15 px-1 py-0.5 text-[10px] font-medium text-accent">
                        <span className="size-1.5 rotate-45 bg-accent" />
                        {m.name}
                      </span>
                    ))}
                    {dayTasks.slice(0, 4).map((tk) => (
                      <button
                        key={tk.id}
                        onClick={() => onOpenTask(tk.id)}
                        className={cn(
                          'truncate rounded bg-surface-sunken px-1 py-0.5 text-start text-[10px] text-text-muted hover:text-text',
                          tk.completedAt && 'line-through opacity-60',
                        )}
                      >
                        {tk.key} {tk.title}
                      </button>
                    ))}
                    {dayTasks.length > 4 && <span className="px-1 text-[10px] text-text-subtle">+{dayTasks.length - 4}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Scrollable>
      )}
    </div>
  );
}
