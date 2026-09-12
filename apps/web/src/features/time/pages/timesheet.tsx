import { useMemo, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import {
  formatDuration,
  usePendingTimesheets,
  useReviewTimesheet,
  useSubmitTimesheet,
  useTimesheetWeek,
} from '@/features/time/time.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Input, Skeleton, toast } from '@/components/ui';
import { MyScheduleCard } from '@/features/time/my-schedule-card';
import { cn } from '@/lib/cn';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimesheetPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, slug, can } = useWorkspace();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const periodStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }).toISOString(),
    [weekOffset],
  );
  const week = useTimesheetWeek(workspaceId, periodStart);
  const submit = useSubmitTimesheet(workspaceId);
  const canApprove = can('timesheet.approve');
  const pending = usePendingTimesheets(workspaceId, canApprove);
  const review = useReviewTimesheet(workspaceId);

  const status = week.data?.status ?? 'draft';
  const dayTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const row of week.data?.rows ?? []) row.byDay.forEach((s, i) => (totals[i]! += s));
    return totals;
  }, [week.data?.rows]);

  return (
    <>
      <PageHeader title={t('nav.timesheet')} />
      <PageBody className="space-y-8">
        <MyScheduleCard />
        <section>
          <div className="mb-3 flex items-center gap-3">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-text">
              {week.data ? `${format(new Date(week.data.periodStart), 'MMM d')} – ${format(new Date(week.data.periodEnd), 'MMM d, yyyy')}` : '—'}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              disabled={weekOffset >= 0}
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <Badge tone={status === 'approved' ? 'success' : status === 'submitted' ? 'warning' : status === 'rejected' ? 'danger' : 'neutral'}>
              {t(`timesheet.status.${status}`)}
            </Badge>
            <div className="ms-auto flex items-center gap-3">
              <span className="text-sm text-text-muted">
                {t('timesheet.weekTotal')}: <span className="font-semibold text-text">{formatDuration(week.data?.totalSeconds ?? 0)}</span>
              </span>
              {can('timesheet.submit') && (status === 'draft' || status === 'rejected') && (
                <Button
                  size="sm"
                  loading={submit.isPending}
                  onClick={() =>
                    submit.mutate(periodStart, {
                      onSuccess: () => toast.success(t('timesheet.submitted')),
                      onError: (e) => toast.error(errorText(e, t)),
                    })
                  }
                >
                  {t('timesheet.submit')}
                </Button>
              )}
            </div>
          </div>

          {week.data?.reviewNote && status === 'rejected' && (
            <p className="mb-3 rounded-lg bg-danger-soft/50 px-3 py-2 text-sm text-danger">{week.data.reviewNote}</p>
          )}

          {week.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (week.data?.rows.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-subtle">{t('timesheet.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-xs uppercase tracking-wide text-text-subtle">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">{t('timesheet.task')}</th>
                    {DAYS.map((d) => (
                      <th key={d} className="w-16 px-2 py-2.5 text-center font-medium">{d}</th>
                    ))}
                    <th className="w-20 px-3 py-2.5 text-end font-medium">{t('common.total' as never, { defaultValue: 'Total' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {week.data!.rows.map((row) => (
                    <tr key={row.taskId} className="bg-surface transition-colors hover:bg-surface-sunken/60">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => navigate(`/w/${slug}/projects/${row.projectId}?task=${row.taskId}`)}
                          className="text-start hover:underline"
                        >
                          <span className="me-1.5 font-mono text-[11px] text-text-subtle">{row.taskKey}</span>
                          {row.taskTitle}
                        </button>
                      </td>
                      {row.byDay.map((s, i) => (
                        <td key={i} className={cn('px-2 py-2.5 text-center text-xs', s === 0 ? 'text-text-subtle' : 'text-text')}>
                          {s === 0 ? '·' : formatDuration(s)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-end font-medium">{formatDuration(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-sunken text-xs font-semibold">
                    <td className="px-4 py-2.5">{t('common.total' as never, { defaultValue: 'Total' })}</td>
                    {dayTotals.map((s, i) => (
                      <td key={i} className="px-2 py-2.5 text-center">{s === 0 ? '·' : formatDuration(s)}</td>
                    ))}
                    <td className="px-3 py-2.5 text-end">{formatDuration(week.data!.totalSeconds)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {canApprove && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('timesheet.pending')} {(pending.data?.length ?? 0) > 0 && <span className="text-text-subtle">{pending.data!.length}</span>}
            </h2>
            {(pending.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-subtle">{t('timesheet.noPending')}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                {pending.data!.map((p, i) => (
                  <PendingRow
                    key={p.id}
                    p={p}
                    borderTop={i > 0}
                    onApprove={() => review.mutate({ timesheetId: p.id, decision: 'approve' }, { onSuccess: () => toast.success(t('timesheet.approved')) })}
                    onReject={(note) => review.mutate({ timesheetId: p.id, decision: 'reject', note }, { onSuccess: () => toast.success(t('timesheet.rejected')) })}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </PageBody>
    </>
  );
}

function PendingRow({
  p,
  borderTop,
  onApprove,
  onReject,
}: {
  p: { id: string; userName: string; periodStart: string; periodEnd: string; totalSeconds: number };
  borderTop: boolean;
  onApprove: () => void;
  onReject: (note: string | undefined) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className={cn('bg-surface px-4 py-3', borderTop && 'border-t border-border')}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text">{p.userName}</span>
        <span className="text-xs text-text-subtle">
          {format(new Date(p.periodStart), 'MMM d')} – {format(new Date(p.periodEnd), 'MMM d')}
        </span>
        <span className="text-xs text-text-muted">{formatDuration(p.totalSeconds)}</span>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={onApprove}>
            <Check className="size-3.5" />
            {t('timesheet.approve')}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRejecting((v) => !v)}>
            <X className="size-3.5" />
            {t('timesheet.reject')}
          </Button>
        </div>
      </div>
      {rejecting && (
        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('timesheet.rejectReason')} />
          </div>
          <Button size="sm" variant="danger" onClick={() => onReject(note || undefined)}>
            {t('timesheet.reject')}
          </Button>
        </div>
      )}
    </div>
  );
}
