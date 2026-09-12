import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { feedback } from '@/lib/api/mutation-feedback';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Button, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton } from '@/components/ui';
import {
  useCreateDashboard,
  useDashboardRender,
  useDashboards,
  useDeleteDashboard,
  useUpdateDashboard,
  type WidgetDef,
} from '@/features/dashboards/dashboards.api';
import { WidgetCard } from '@/features/dashboards/widget-card';

const SOURCES = ['task_count', 'project_status', 'throughput', 'priority_breakdown'];

export function DashboardsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const dashboards = useDashboards(workspaceId);
  const create = useCreateDashboard(workspaceId);
  const del = useDeleteDashboard(workspaceId);

  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const active = selected ?? dashboards.data?.[0]?.id ?? null;

  return (
    <>
      <PageHeader
        title={t('dashboards.title')}
        description={t('dashboards.description')}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t('dashboards.newDashboard')}
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {dashboards.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : dashboards.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void dashboards.refetch()} />
        ) : dashboards.data!.length === 0 ? (
          <EmptyState title={t('dashboards.empty')} icon={<LayoutDashboard className="size-5" />} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {dashboards.data!.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d.id)}
                  className={
                    active === d.id
                      ? 'rounded-lg bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary'
                      : 'rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-sunken'
                  }
                >
                  {d.name}
                </button>
              ))}
            </div>
            {active && (
              <DashboardCanvas
                dashboardId={active}
                onDelete={() =>
                  del.mutate(active, {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.deleted') }).onSuccess();
                      setSelected(null);
                    },
                  })
                }
              />
            )}
          </>
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('dashboards.newDashboard')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!name.trim()}
              onClick={() =>
                create.mutate(
                  { name: name.trim(), shared: true },
                  {
                    onError: feedback(t).onError,
                    onSuccess: (d) => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setSelected(d.id);
                      setCreating(false);
                      setName('');
                    },
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <Field label={t('dashboards.name')}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </Dialog>
    </>
  );
}

function DashboardCanvas({ dashboardId, onDelete }: { dashboardId: string; onDelete: () => void }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const render = useDashboardRender(workspaceId, dashboardId);
  const update = useUpdateDashboard(workspaceId);
  const projects = useProjects(workspaceId);

  const [adding, setAdding] = useState(false);
  const [w, setW] = useState({ title: '', source: 'task_count', projectId: '' });

  if (render.isLoading || !render.data) return <Skeleton className="h-64 w-full" />;
  const d = render.data;

  const persist = (widgets: WidgetDef[]): void => {
    update.mutate(
      { id: dashboardId, widgets: widgets.map((x) => ({ type: x.type, title: x.title, source: x.source, config: x.config, layout: x.layout })) },
      feedback(t, { success: false }),
    );
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          {t('dashboards.addWidget')}
        </Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          {t('common.delete')}
        </Button>
      </div>
      {d.widgets.length === 0 ? (
        <EmptyState title={t('dashboards.noWidgets')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              data={d.data[widget.id]}
              onRemove={() => persist(d.widgets.filter((x) => x.id !== widget.id))}
            />
          ))}
        </div>
      )}

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title={t('dashboards.addWidget')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              disabled={!w.title.trim()}
              onClick={() => {
                const next: WidgetDef[] = [
                  ...d.widgets,
                  {
                    id: 'new',
                    type: w.source === 'task_count' ? 'stat' : w.source === 'throughput' ? 'bar' : w.source === 'priority_breakdown' ? 'pie' : 'table',
                    title: w.title.trim(),
                    source: w.source,
                    config: w.projectId ? { projectId: w.projectId } : {},
                    layout: { x: 0, y: 0, w: 4, h: 3 },
                  },
                ];
                persist(next);
                setAdding(false);
                setW({ title: '', source: 'task_count', projectId: '' });
              }}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('dashboards.widgetTitle')}>
            <Input autoFocus value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} />
          </Field>
          <Field label={t('dashboards.dataSource')}>
            <Select value={w.source} onChange={(v) => setW({ ...w, source: v ?? 'task_count' })} options={SOURCES.map((s) => ({ value: s, label: t(`dashboards.source.${s}`) }))} />
          </Field>
          <Field label={t('nav.projects')}>
            <Select
              value={w.projectId || null}
              onChange={(v) => setW({ ...w, projectId: v ?? '' })}
              options={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
              clearable
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
