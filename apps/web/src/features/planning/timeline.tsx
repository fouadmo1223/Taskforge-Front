import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
  startOfDay,
} from 'date-fns';
import { CalendarRange, Flag, Plus } from 'lucide-react';
import type { StatusCategory } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { usePatchTask } from '@/features/tasks/tasks.api';
import { Scrollable } from '@/components/ui/scrollable';
import { Button, ErrorState, Skeleton, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  scheduleImpact,
  useCreateBaseline,
  useTimeline,
  type ScheduleImpactRow,
  type TimelineTask,
} from './planning.api';
import { ScheduleImpactDialog } from './schedule-impact-dialog';

type Zoom = 'day' | 'week' | 'month';
const PX_PER_DAY: Record<Zoom, number> = { day: 34, week: 12, month: 4 };
const ROW_H = 40;
const HEAD_H = 40;
const BAR_H = 20;
const NAME_W = 264;

const BAR_COLOR: Record<StatusCategory, string> = {
  backlog: 'bg-text-subtle/60',
  todo: 'bg-info',
  in_progress: 'bg-primary',
  blocked: 'bg-danger',
  in_review: 'bg-warning',
  done: 'bg-success',
  cancelled: 'bg-text-subtle/40',
};

interface Props {
  projectId: string;
  onOpenTask: (id: string) => void;
}

export function Timeline({ projectId, onOpenTask }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const q = useTimeline(workspaceId, projectId);
  const patch = usePatchTask(workspaceId);
  const createBaseline = useCreateBaseline(workspaceId, projectId);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [showBaseline, setShowBaseline] = useState(true);
  const [impactRows, setImpactRows] = useState<ScheduleImpactRow[] | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const drag = useRef<{ taskId: string; mode: 'move' | 'start' | 'end'; startX: number; origStart: number; origEnd: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<Record<string, { start: number; end: number }>>({});

  const pxDay = PX_PER_DAY[zoom];

  const { rangeStart, days, ticks, months } = useMemo(() => {
    const tasks = q.data?.tasks ?? [];
    const milestones = q.data?.milestones ?? [];
    const dates: number[] = [];
    for (const tk of tasks) {
      if (tk.startDate) dates.push(new Date(tk.startDate).getTime());
      if (tk.dueDate) dates.push(new Date(tk.dueDate).getTime());
    }
    for (const m of milestones) dates.push(new Date(m.date).getTime());
    const now = Date.now();
    const min = dates.length ? Math.min(...dates) : now - 7 * 864e5;
    const max = dates.length ? Math.max(...dates) : now + 21 * 864e5;
    const rs = startOfDay(addDays(new Date(min), -3));
    const re = startOfDay(addDays(new Date(max), 7));
    const totalDays = Math.max(14, differenceInCalendarDays(re, rs));
    const tickPoints =
      zoom === 'month'
        ? eachMonthOfInterval({ start: rs, end: re })
        : eachWeekOfInterval({ start: rs, end: re }, { weekStartsOn: 1 });
    const monthPoints = eachMonthOfInterval({ start: rs, end: re });
    return {
      rangeStart: rs,
      days: totalDays,
      ticks: tickPoints.map((d) => ({
        x: differenceInCalendarDays(d, rs) * pxDay,
        label: format(d, zoom === 'month' ? 'MMM yyyy' : 'MMM d'),
      })),
      months: monthPoints.map((d, i) => ({
        x: Math.max(0, differenceInCalendarDays(d, rs) * pxDay),
        label: format(d, 'MMMM yyyy'),
        shaded: i % 2 === 1,
      })),
    };
  }, [q.data, zoom, pxDay]);

  const xOf = (iso: string): number => differenceInCalendarDays(new Date(iso), rangeStart) * pxDay;
  const todayX = differenceInCalendarDays(new Date(), rangeStart) * pxDay;

  // hierarchy-ordered rows
  const rows = useMemo(() => {
    const tasks = q.data?.tasks ?? [];
    const byParent = new Map<string | null, TimelineTask[]>();
    for (const tk of tasks) {
      const p = tk.parentTaskId;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(tk);
    }
    const out: TimelineTask[] = [];
    const walk = (parent: string | null): void => {
      for (const tk of byParent.get(parent) ?? []) {
        out.push(tk);
        walk(tk.id);
      }
    };
    walk(null);
    return out;
  }, [q.data?.tasks]);

  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);
  const anyScheduled = rows.some((r) => r.startDate && r.dueDate);

  // weekend bands (day zoom only — too dense to be useful when zoomed out)
  const weekends = useMemo(() => {
    if (zoom !== 'day') return [] as number[];
    const out: number[] = [];
    for (let d = 0; d < days; d += 1) {
      const day = addDays(rangeStart, d).getDay();
      if (day === 0 || day === 6) out.push(d * pxDay);
    }
    return out;
  }, [zoom, days, pxDay, rangeStart]);

  function onPointerDown(e: ReactPointerEvent, task: TimelineTask, mode: 'move' | 'start' | 'end'): void {
    if (!can('task.update') || !task.startDate || !task.dueDate) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      taskId: task.id,
      mode,
      startX: e.clientX,
      origStart: new Date(task.startDate).getTime(),
      origEnd: new Date(task.dueDate).getTime(),
    };
  }
  function onPointerMove(e: ReactPointerEvent): void {
    const d = drag.current;
    if (!d) return;
    const deltaDays = Math.round((e.clientX - d.startX) / pxDay);
    if (deltaDays === 0) {
      setPreview((p) => (p[d.taskId] ? { ...p, [d.taskId]: { start: d.origStart, end: d.origEnd } } : p));
      return;
    }
    const shift = deltaDays * 864e5;
    const next =
      d.mode === 'move'
        ? { start: d.origStart + shift, end: d.origEnd + shift }
        : d.mode === 'start'
          ? { start: Math.min(d.origStart + shift, d.origEnd - 864e5), end: d.origEnd }
          : { start: d.origStart, end: Math.max(d.origEnd + shift, d.origStart + 864e5) };
    setPreview((p) => ({ ...p, [d.taskId]: next }));
  }
  async function onPointerUp(): Promise<void> {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const pv = preview[d.taskId];
    setPreview((p) => {
      const { [d.taskId]: _drop, ...rest } = p;
      return rest;
    });
    if (!pv || (pv.start === d.origStart && pv.end === d.origEnd)) return;

    const startIso = new Date(pv.start).toISOString();
    const dueIso = new Date(pv.end).toISOString();
    try {
      await patch.mutateAsync({ taskId: d.taskId, startDate: startIso, dueDate: dueIso });
      void q.refetch();
      if (pv.end > d.origEnd && can('dependency.manage')) {
        const impact = await scheduleImpact(workspaceId, d.taskId, dueIso).catch(() => [] as ScheduleImpactRow[]);
        if (impact.length > 0) setImpactRows(impact);
      }
    } catch {
      toast.error(t('errors.generic'));
      void q.refetch();
    }
  }

  if (q.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-full min-h-64 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <ErrorState title={t('errors.generic')} onRetry={() => void q.refetch()} retryLabel={t('common.retry')} />;
  }

  const contentW = days * pxDay;
  const rowsH = rows.length * ROW_H;

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                zoom === z ? 'bg-primary text-primary-contrast' : 'text-text-muted hover:bg-surface-sunken',
              )}
            >
              {t(`timeline.${z}`)}
            </button>
          ))}
        </div>
        {q.data.baseline && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-text-muted hover:bg-surface-sunken">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
              className="size-3.5 rounded border-border accent-primary"
            />
            {t('timeline.baseline')}: <span className="font-medium text-text">{q.data.baseline.name}</span>
          </label>
        )}
        <div className="ms-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-text-subtle">
            <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-danger ring-offset-1 ring-offset-surface" />
            {t('timeline.criticalPath')}
          </span>
          {can('milestone.manage') && (
            <Button
              size="sm"
              variant="secondary"
              loading={createBaseline.isPending}
              onClick={() => createBaseline.mutate(undefined, { onSuccess: () => toast.success(t('timeline.baselineSaved')) })}
            >
              {t('timeline.setBaseline')}
            </Button>
          )}
        </div>
      </div>

      <Scrollable axis="both" className="flex-1">
        <div className="relative flex min-h-full" style={{ width: NAME_W + contentW }}>
          {/* ── name column ─────────────────────────────────────────── */}
          <div className="sticky start-0 z-20 flex shrink-0 flex-col border-e border-border bg-surface" style={{ width: NAME_W }}>
            <div
              className="sticky top-0 z-10 flex items-center border-b border-border bg-surface-sunken/60 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              style={{ height: HEAD_H }}
            >
              {t('timeline.task')}
            </div>
            {rows.map((tk, i) => (
              <button
                key={tk.id}
                onClick={() => onOpenTask(tk.id)}
                onMouseEnter={() => setHoverRow(tk.id)}
                onMouseLeave={() => setHoverRow(null)}
                style={{ height: ROW_H, paddingInlineStart: 12 + tk.depth * 14 }}
                className={cn(
                  'flex w-full items-center gap-2 border-b border-border/50 pe-2 text-start transition-colors',
                  i % 2 === 1 && 'bg-surface-sunken/30',
                  hoverRow === tk.id && 'bg-primary-soft/60',
                )}
              >
                <span className="shrink-0 font-mono text-[10px] text-text-subtle">{tk.key}</span>
                <span className={cn('min-w-0 flex-1 truncate text-xs text-text', tk.completedAt && 'text-text-subtle line-through')}>
                  {tk.title}
                </span>
                {tk.critical && <span className="size-1.5 shrink-0 rounded-full bg-danger" title={t('timeline.criticalPath')} />}
              </button>
            ))}
            <div className="flex-1 bg-surface" />
          </div>

          {/* ── chart ───────────────────────────────────────────────── */}
          <div
            className="relative min-h-full"
            style={{ width: contentW }}
            onPointerMove={onPointerMove}
            onPointerUp={() => void onPointerUp()}
          >
            {/* month band shading */}
            {months.map((m, i) =>
              m.shaded ? (
                <div
                  key={`ms${i}`}
                  className="absolute bottom-0 bg-surface-sunken/25"
                  style={{ left: m.x, top: HEAD_H, width: (months[i + 1]?.x ?? contentW) - m.x }}
                />
              ) : null,
            )}

            {/* weekend bands */}
            {weekends.map((x, i) => (
              <div key={`we${i}`} className="absolute bottom-0 bg-text-subtle/[0.06]" style={{ left: x, top: HEAD_H, width: pxDay }} />
            ))}

            {/* header */}
            <div
              className="sticky top-0 z-10 border-b border-border bg-surface-sunken/60"
              style={{ height: HEAD_H }}
            >
              {/* month row */}
              <div className="relative h-1/2 border-b border-border/50">
                {months.map((m, i) => (
                  <div
                    key={`mh${i}`}
                    className="absolute top-0 flex h-full items-center whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-wide text-text-subtle"
                    style={{ left: m.x }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* tick row */}
              <div className="relative h-1/2">
                {ticks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full items-center border-s border-border/50 ps-1 text-[10px] font-medium text-text-muted"
                    style={{ left: tick.x }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </div>

            {/* vertical gridlines */}
            {ticks.map((tick, i) => (
              <div key={`g${i}`} className="absolute bottom-0 w-px bg-border/40" style={{ left: tick.x, top: HEAD_H }} />
            ))}

            {/* row stripes + hover (fill available height) */}
            <div className="absolute inset-x-0 bottom-0" style={{ top: HEAD_H }}>
              {rows.map((tk, i) => (
                <div
                  key={`r${tk.id}`}
                  onMouseEnter={() => setHoverRow(tk.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  className={cn(
                    'transition-colors',
                    i % 2 === 1 && 'bg-surface-sunken/30',
                    hoverRow === tk.id && 'bg-primary-soft/40',
                  )}
                  style={{ height: ROW_H }}
                />
              ))}
            </div>

            {/* today marker */}
            {todayX >= 0 && todayX <= contentW && (
              <>
                <div className="absolute bottom-0 z-10 w-0.5 bg-danger/60" style={{ left: todayX, top: HEAD_H }} />
                <div
                  className="absolute z-20 -translate-x-1/2 rounded-full bg-danger px-1.5 py-px text-[9px] font-semibold text-white"
                  style={{ left: todayX, top: HEAD_H - 8 }}
                >
                  {t('timeline.today')}
                </div>
              </>
            )}

            {/* dependency connectors */}
            <svg className="pointer-events-none absolute left-0 z-10" style={{ top: HEAD_H }} width={contentW} height={Math.max(rowsH, 1)}>
              {q.data.dependencies
                .filter((d) => ['blocks', 'blocked_by', 'starts_after', 'finishes_before'].includes(d.type))
                .map((d) => {
                  const predId = d.type === 'blocks' || d.type === 'finishes_before' ? d.fromTaskId : d.toTaskId;
                  const succId = d.type === 'blocks' || d.type === 'finishes_before' ? d.toTaskId : d.fromTaskId;
                  const pr = rows.find((r) => r.id === predId);
                  const sr = rows.find((r) => r.id === succId);
                  if (!pr || !sr || !pr.dueDate || !sr.startDate) return null;
                  const x1 = xOf(pr.dueDate);
                  const y1 = (rowIndex.get(predId) ?? 0) * ROW_H + ROW_H / 2;
                  const x2 = xOf(sr.startDate);
                  const y2 = (rowIndex.get(succId) ?? 0) * ROW_H + ROW_H / 2;
                  const midX = Math.max(x1 + 12, x2 - 12);
                  return (
                    <path
                      key={d.id}
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 6} ${y2}`}
                      className="stroke-text-subtle/70"
                      strokeWidth={1.5}
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-text-subtle/70" />
                </marker>
              </defs>
            </svg>

            {/* milestone diamonds */}
            {q.data.milestones.map((m) => {
              const x = xOf(m.date);
              if (x < 0 || x > contentW) return null;
              return (
                <div
                  key={m.id}
                  className="absolute z-20 -translate-x-1/2"
                  style={{ left: x, top: HEAD_H - 6 }}
                  title={`${m.name} — ${format(new Date(m.date), 'MMM d')}`}
                >
                  <div className="size-3 rotate-45 rounded-[2px] border border-accent bg-accent shadow-sm" />
                  <div className="absolute left-1/2 top-3 w-px -translate-x-1/2 bg-accent/30" style={{ height: Math.max(rowsH, 0) }} />
                </div>
              );
            })}

            {/* bars */}
            <div className="absolute left-0" style={{ top: HEAD_H, width: contentW, height: Math.max(rowsH, 1) }}>
              {rows.map((tk, i) => {
                const pv = preview[tk.id];
                const s = pv ? new Date(pv.start).toISOString() : tk.startDate;
                const e = pv ? new Date(pv.end).toISOString() : tk.dueDate;
                const rowTop = i * ROW_H;
                const barTop = rowTop + (ROW_H - BAR_H) / 2;

                if (!s || !e) {
                  const px = Math.min(Math.max(todayX, 0), Math.max(contentW - 130, 0));
                  return (
                    <button
                      key={tk.id}
                      onClick={() => onOpenTask(tk.id)}
                      className="group absolute flex items-center gap-1 rounded-md border border-dashed border-border px-2 text-[10px] text-text-subtle hover:border-primary hover:text-primary"
                      style={{ top: barTop, left: px, height: BAR_H }}
                    >
                      <Plus className="size-3" />
                      {t('timeline.addDates')}
                    </button>
                  );
                }
                const left = xOf(s);
                const width = Math.max(pxDay, xOf(e) - left + pxDay);
                return (
                  <div key={tk.id}>
                    {showBaseline && tk.baseline?.startDate && tk.baseline.dueDate && (
                      <div
                        className="absolute rounded-full border border-dashed border-text-subtle/50 bg-text-subtle/10"
                        style={{
                          top: barTop + BAR_H + 1,
                          left: xOf(tk.baseline.startDate),
                          width: Math.max(4, xOf(tk.baseline.dueDate) - xOf(tk.baseline.startDate) + pxDay),
                          height: 4,
                        }}
                      />
                    )}
                    <div
                      onPointerDown={(ev) => onPointerDown(ev, tk, 'move')}
                      onDoubleClick={() => onOpenTask(tk.id)}
                      onMouseEnter={() => setHoverRow(tk.id)}
                      onMouseLeave={() => setHoverRow(null)}
                      title={`${tk.title} · ${format(new Date(s), 'MMM d')} – ${format(new Date(e), 'MMM d')}`}
                      className={cn(
                        'group absolute flex items-center overflow-hidden rounded-md text-[10px] text-white shadow-sm ring-offset-2 ring-offset-surface',
                        BAR_COLOR[tk.statusCategory],
                        tk.completedAt && 'opacity-60',
                        tk.critical && 'ring-2 ring-danger',
                        can('task.update') && 'cursor-grab active:cursor-grabbing',
                      )}
                      style={{ top: barTop, left, width, height: BAR_H }}
                    >
                      <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-b from-white/20 to-transparent" />
                      <span
                        onPointerDown={(ev) => onPointerDown(ev, tk, 'start')}
                        className="z-10 h-full w-1.5 shrink-0 cursor-ew-resize rounded-s-md bg-black/25 opacity-0 group-hover:opacity-100"
                      />
                      <span className="z-10 truncate px-1.5 font-medium">{tk.title}</span>
                      <span
                        onPointerDown={(ev) => onPointerDown(ev, tk, 'end')}
                        className="z-10 ms-auto h-full w-1.5 shrink-0 cursor-ew-resize rounded-e-md bg-black/25 opacity-0 group-hover:opacity-100"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* empty state */}
            {(rows.length === 0 || !anyScheduled) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center" style={{ top: HEAD_H }}>
                <div className="pointer-events-auto max-w-xs rounded-xl border border-border bg-surface/95 p-5 text-center shadow-pop backdrop-blur-sm">
                  <CalendarRange className="mx-auto mb-2 size-6 text-text-subtle" />
                  <p className="text-sm font-semibold text-text">{t('timeline.emptyTitle')}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('timeline.emptyBody')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Scrollable>

      <ScheduleImpactDialog workspaceId={workspaceId} rows={impactRows} onClose={() => setImpactRows(null)} onApplied={() => void q.refetch()} />

      {q.data.milestones.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sunken/40 px-4 py-2 text-xs text-text-subtle">
          <Flag className="size-3" />
          {q.data.milestones.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5">
              <span className="size-2 rotate-45 rounded-[1px] border border-accent bg-accent" />
              <span className="text-text">{m.name}</span>
              <span className="text-text-subtle">{format(new Date(m.date), 'MMM d')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
