import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addWeeks, startOfWeek } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import type { WorkloadBand } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { useWorkload, type WorkloadRow } from '@/features/time/time.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Avatar, EmptyState, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

const BAND_BAR: Record<WorkloadBand, string> = {
  available: 'bg-info',
  healthy: 'bg-success',
  near_capacity: 'bg-warning',
  overloaded: 'bg-danger',
};
const BAND_CHIP: Record<WorkloadBand, string> = {
  available: 'bg-info/15 text-info',
  healthy: 'bg-success-soft text-success',
  near_capacity: 'bg-warning-soft text-warning',
  overloaded: 'bg-danger-soft text-danger',
};

export function WorkloadPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, slug } = useWorkspace();
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState('2');
  const { byId: usersById } = useWorkspaceUsers(workspaceId);

  const from = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(), []);
  const to = useMemo(() => addWeeks(new Date(from), Number(weeks)).toISOString(), [from, weeks]);
  const q = useWorkload(workspaceId, from, to);

  const rows = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.ratio - a.ratio),
    [q.data],
  );

  return (
    <>
      <PageHeader
        title={t('nav.workload')}
        actions={
          <div className="w-40">
            <Select
              size="sm"
              value={weeks}
              onChange={(v) => v && setWeeks(v)}
              options={[
                { value: '1', label: t('workload.range', { count: 1 }) },
                { value: '2', label: t('workload.range', { count: 2 }) },
                { value: '4', label: t('workload.range', { count: 4 }) },
              ]}
            />
          </div>
        }
      />
      <PageBody>
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('workload.emptyTitle')} description={t('workload.emptyBody')} />
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <WorkloadUserRow
                key={row.userId}
                row={row}
                name={usersById.get(row.userId)?.name ?? 'Member'}
                onOpenTask={(projectId, taskId) => navigate(`/w/${slug}/projects/${projectId}?task=${taskId}`)}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function WorkloadUserRow({
  row,
  name,
  onOpenTask,
}: {
  row: WorkloadRow;
  name: string;
  onOpenTask: (projectId: string, taskId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pct = row.availableHours > 0 ? Math.min(150, (row.plannedHours / row.availableHours) * 100) : row.plannedHours > 0 ? 150 : 0;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
        <Avatar name={name} size="sm" />
        <span className="w-32 shrink-0 truncate text-sm font-medium text-text">{name}</span>
        <div className="min-w-0 flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className={cn('h-full rounded-full transition-all', BAND_BAR[row.band])} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-text-muted">
          {row.plannedHours}h / {row.availableHours}h
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', BAND_CHIP[row.band])}>{t(`workload.band.${row.band}`)}</span>
        {row.unscheduledHours > 0 && (
          <span className="shrink-0 text-[11px] text-text-subtle">+{row.unscheduledHours}h {t('workload.unscheduled')}</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-text-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-2">
          {row.byProject.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {row.byProject.map((p) => (
                <span key={p.projectId} className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
                  {p.projectName}: {p.hours}h
                </span>
              ))}
            </div>
          )}
          {row.tasks.length === 0 ? (
            <p className="py-2 text-sm text-text-subtle">{t('workload.noTasks')}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {row.tasks.map((tk) => (
                <li key={tk.taskId}>
                  <button
                    onClick={() => onOpenTask(tk.projectId, tk.taskId)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-surface-sunken"
                  >
                    <span className="font-mono text-[11px] text-text-subtle">{tk.key}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{tk.title}</span>
                    <span className="shrink-0 text-xs text-text-muted">{tk.plannedHours}h</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
