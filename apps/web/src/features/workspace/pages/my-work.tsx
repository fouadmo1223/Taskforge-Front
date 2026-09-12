import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isPast, isToday, isThisWeek } from 'date-fns';
import { CalendarClock, CheckCircle2, CircleDot, Layers, X } from 'lucide-react';
import { TASK_PRIORITIES } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useMyWork, type MyWorkItem } from '@/features/planning/planning.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { EmptyState, ErrorState, Input, MultiSelect, Select, Skeleton } from '@/components/ui';
import { DueDate, PriorityDot } from '@/components/ui/bits';
import { cn } from '@/lib/cn';

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'nodate';
const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'nodate'];
type Relation = 'all' | 'assignee' | 'reporter' | 'follower';

function bucketOf(item: MyWorkItem): Bucket {
  if (item.completedAt) return 'later';
  if (!item.dueDate) return 'nodate';
  const d = new Date(item.dueDate);
  if (isPast(d) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'week';
  return 'later';
}

export function MyWorkPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, slug } = useWorkspace();
  const navigate = useNavigate();
  const q = useMyWork(workspaceId);

  const [search, setSearch] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [relation, setRelation] = useState<Relation>('all');

  const openItems = useMemo(() => (q.data?.items ?? []).filter((i) => !i.completedAt), [q.data?.items]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of openItems) if (!seen.has(i.projectId)) seen.set(i.projectId, i.projectName);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [openItems]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return openItems.filter((i) => {
      if (term && !i.title.toLowerCase().includes(term) && !i.key.toLowerCase().includes(term)) return false;
      if (projectIds.length && !projectIds.includes(i.projectId)) return false;
      if (priorities.length && !priorities.includes(i.priority)) return false;
      if (relation !== 'all' && i.relation !== relation) return false;
      return true;
    });
  }, [openItems, search, projectIds, priorities, relation]);

  const grouped = useMemo(() => {
    const map = new Map<Bucket, MyWorkItem[]>(BUCKET_ORDER.map((b) => [b, []]));
    for (const item of filtered) map.get(bucketOf(item))!.push(item);
    return map;
  }, [filtered]);

  const bucketLabel: Record<Bucket, string> = {
    overdue: t('myWork.overdue'),
    today: t('myWork.today'),
    week: t('myWork.thisWeek'),
    later: t('myWork.later'),
    nodate: t('myWork.noDate'),
  };

  const stats = q.data?.stats;
  const activeFilters = search.trim() !== '' || projectIds.length > 0 || priorities.length > 0 || relation !== 'all';
  const clearFilters = (): void => {
    setSearch('');
    setProjectIds([]);
    setPriorities([]);
    setRelation('all');
  };

  return (
    <>
      <PageHeader title={t('nav.myWork')} />
      <PageBody className="space-y-6">
        {q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : q.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void q.refetch()} retryLabel={t('common.retry')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Layers className="size-4" />} label={t('myWork.assigned')} value={stats?.assigned ?? 0} />
              <Stat icon={<CalendarClock className="size-4" />} label={t('myWork.overdue')} value={stats?.overdue ?? 0} tone="danger" />
              <Stat icon={<CircleDot className="size-4" />} label={t('myWork.dueToday')} value={stats?.dueToday ?? 0} tone="warning" />
              <Stat icon={<CheckCircle2 className="size-4" />} label={t('myWork.doneThisWeek')} value={stats?.completedLast7d ?? 0} tone="success" />
            </div>

            {openItems.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-6" />} title={t('myWork.clearTitle')} description={t('myWork.clearBody')} />
            ) : (
              <>
                {/* filter bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[10rem] flex-1">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('myWork.searchPlaceholder')}
                    />
                  </div>
                  <div className="w-44">
                    <MultiSelect
                      value={projectIds}
                      onChange={setProjectIds}
                      options={projectOptions}
                      placeholder={t('myWork.filterProject')}
                    />
                  </div>
                  <div className="w-40">
                    <MultiSelect
                      value={priorities}
                      onChange={setPriorities}
                      options={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
                      placeholder={t('priority.label')}
                    />
                  </div>
                  <div className="w-44">
                    <Select
                      value={relation}
                      onChange={(v) => setRelation((v as Relation) ?? 'all')}
                      options={[
                        { value: 'all', label: t('common.all') },
                        { value: 'assignee', label: t('myWork.relAssignee') },
                        { value: 'reporter', label: t('myWork.relReporter') },
                        { value: 'follower', label: t('myWork.relFollower') },
                      ]}
                    />
                  </div>
                  {activeFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs text-text-muted hover:bg-surface-sunken hover:text-text"
                    >
                      <X className="size-3.5" />
                      {t('common.clear')}
                    </button>
                  )}
                  <span className="ms-auto text-xs text-text-subtle">
                    {t('myWork.showing', { shown: filtered.length, total: openItems.length })}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState icon={<CircleDot className="size-6" />} title={t('myWork.noMatch')} />
                ) : (
                  <div className="space-y-5">
                    {BUCKET_ORDER.map((b) => {
                      const items = grouped.get(b) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <section key={b}>
                          <h2 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', b === 'overdue' ? 'text-danger' : 'text-text-muted')}>
                            {bucketLabel[b]} <span className="text-text-subtle">{items.length}</span>
                          </h2>
                          <div className="overflow-hidden rounded-xl border border-border">
                            {items.map((item, i) => (
                              <button
                                key={item.id}
                                onClick={() => navigate(`/w/${slug}/projects/${item.projectId}?task=${item.id}`)}
                                className={cn(
                                  'flex w-full items-center gap-3 bg-surface px-4 py-2.5 text-start hover:bg-surface-sunken',
                                  i > 0 && 'border-t border-border',
                                )}
                              >
                                <PriorityDot priority={item.priority} />
                                <span className="font-mono text-[11px] text-text-subtle">{item.key}</span>
                                <span className="min-w-0 flex-1 truncate text-sm text-text">{item.title}</span>
                                <span className="hidden shrink-0 text-xs text-text-subtle sm:inline">{item.projectName}</span>
                                <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-muted">{item.columnName}</span>
                                {item.dueDate && <DueDate value={item.dueDate} />}
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'danger' | 'warning' | 'success';
}): React.ReactElement {
  const toneCls =
    tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium text-text-muted', value > 0 && tone && toneCls)}>
        <span className={toneCls}>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </div>
  );
}
