import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { Badge, Spinner } from '@/components/ui';
import { LanguageThemeControls } from '@/components/layout/language-theme-controls';
import { BrandMark } from '@/components/layout/brand-mark';
import { WidgetCard } from '@/features/dashboards/widget-card';
import type { WidgetDef } from '@/features/dashboards/dashboards.api';

interface ProjectSnapshot {
  project: { key: string; name: string; description: string; status: string; color: string };
  columns: { id: string; name: string; statusCategory: string }[];
  tasks: { key: string; title: string; priority: string; columnId: string; dueDate: string | null }[];
}
interface DashboardSnapshot {
  name: string;
  widgets: WidgetDef[];
  data: Record<string, unknown>;
}

export function PublicSharePage(): React.ReactElement {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['share', token],
    queryFn: () => api.get<{ resourceType: 'project' | 'dashboard'; snapshot: unknown }>(`/share/${token}`, { anonymous: true }),
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <BrandMark className="size-4 text-primary" />
          {t('common.appName')}
        </span>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{t('sharing.readOnly')}</Badge>
          <LanguageThemeControls compact />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {q.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : q.isError || !q.data ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-text-muted">
            {t('sharing.unavailable')}
          </p>
        ) : q.data.resourceType === 'project' ? (
          <ProjectView snapshot={q.data.snapshot as ProjectSnapshot} />
        ) : (
          <DashboardView snapshot={q.data.snapshot as DashboardSnapshot} />
        )}
      </main>
    </div>
  );
}

function ProjectView({ snapshot }: { snapshot: ProjectSnapshot }): React.ReactElement {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="size-3 rounded" style={{ backgroundColor: snapshot.project.color }} />
        <h1 className="text-lg font-semibold text-text">{snapshot.project.name}</h1>
        <span className="font-mono text-xs text-text-subtle">{snapshot.project.key}</span>
      </div>
      {snapshot.project.description && <p className="mb-4 text-sm text-text-muted">{snapshot.project.description}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {snapshot.columns.map((col) => {
          const tasks = snapshot.tasks.filter((tk) => tk.columnId === col.id);
          return (
            <div key={col.id} className="w-64 shrink-0 rounded-xl border border-border bg-surface-sunken/40 p-2">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {col.name} <span className="text-text-subtle">{tasks.length}</span>
              </h2>
              <div className="space-y-1.5">
                {tasks.map((tk) => (
                  <div key={tk.key} className="rounded-lg border border-border bg-surface p-2 text-sm">
                    <span className="me-1.5 font-mono text-[10px] text-text-subtle">{tk.key}</span>
                    {tk.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardView({ snapshot }: { snapshot: DashboardSnapshot }): React.ReactElement {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-text">{snapshot.name}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.widgets.map((w) => (
          <WidgetCard key={w.id} widget={w} data={snapshot.data[w.id]} />
        ))}
      </div>
    </div>
  );
}
